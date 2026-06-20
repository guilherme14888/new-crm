// Cliente HTTP compartilhado pelos conectores.
//
// Política anti-penalidade (PNCP não publica limite numérico): garantia por
// COMPORTAMENTO, e agora CIENTE DE HOST — o cooldown de um host (ex.: PNCP em
// penalidade) NÃO bloqueia outro host (ex.: Compras.gov federal, usado como
// redundância/failover do PNCP).
//   1) Taxa global conservadora (serializa todas as chamadas).
//   2) Circuit breaker POR HOST: ao 429, aquele host entra em COOLDOWN e nenhuma
//      chamada PARA ELE sai até passar (respeitando Retry-After).
//   3) Cooldown persistido por host (ingest_throttle) → worker, manual e reinícios
//      respeitam a mesma pausa.

const db = require('../db');

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Taxa global conservadora ────────────────────────────────────────────────
const RATE_PER_SEC = Math.max(0.2, parseFloat(process.env.PNCP_RATE_PER_SEC || '2'));
const MIN_INTERVAL = 1000 / RATE_PER_SEC;
let nextSlot = 0;

// ── Circuit breaker / cooldown POR HOST ─────────────────────────────────────
const COOLDOWN_CAP_MS = 5 * 60 * 1000;   // teto do cooldown (5 min)
const GATE_WAIT_CAP_MS = 60 * 1000;      // espera máx no gate; além disso, aborta a chamada
const cooldownByHost = new Map();        // host → epoch ms
const consec429ByHost = new Map();       // host → contador
const dbSyncAt = new Map();              // host → epoch ms da última leitura do banco
let throttle429 = 0;

const hostOf = (url) => { try { return new URL(url).host; } catch { return 'desconhecido'; } };
function cooldownRemaining(host) { return Math.max(0, (cooldownByHost.get(host) || 0) - Date.now()); }

async function syncCooldownFromDb(host) {
  const now = Date.now();
  if (now - (dbSyncAt.get(host) || 0) < 5000) return;
  dbSyncAt.set(host, now);
  try {
    const [rows] = await db.query('SELECT cooldown_until FROM ingest_throttle WHERE host = ? LIMIT 1', [host]);
    if (rows[0] && rows[0].cooldown_until) {
      const until = new Date(rows[0].cooldown_until + 'Z').getTime();
      if (Number.isFinite(until) && until > (cooldownByHost.get(host) || 0)) cooldownByHost.set(host, until);
    }
  } catch { /* best-effort */ }
}

async function saveCooldown(host, until, reason) {
  try {
    const iso = new Date(until).toISOString().slice(0, 19).replace('T', ' ');
    await db.query(
      `INSERT INTO ingest_throttle (host, cooldown_until, reason) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE cooldown_until = VALUES(cooldown_until), reason = VALUES(reason)`,
      [host, iso, (reason || '429').slice(0, 255)]
    );
  } catch { /* best-effort */ }
}

function trip429(host, retryAfterMs) {
  const c = (consec429ByHost.get(host) || 0) + 1;
  consec429ByHost.set(host, c);
  throttle429++;
  const backoff = retryAfterMs && retryAfterMs > 0
    ? Math.min(COOLDOWN_CAP_MS, retryAfterMs)
    : Math.min(COOLDOWN_CAP_MS, 10000 * Math.pow(2, c - 1)); // 10s,20s,40s… cap 5min
  const until = Date.now() + backoff;
  if (until > (cooldownByHost.get(host) || 0)) { cooldownByHost.set(host, until); saveCooldown(host, until, `429 x${c}`); }
  return backoff;
}
function noteSuccess(host) { consec429ByHost.set(host, 0); }

/** Porta de TODA requisição: cooldown do host + taxa mínima global. */
async function gate(host) {
  await syncCooldownFromDb(host);
  let now = Date.now();
  const until = cooldownByHost.get(host) || 0;
  if (until > now) {
    const left = until - now;
    if (left > GATE_WAIT_CAP_MS) {
      const err = new Error(`${host} em cooldown por mais ${Math.round(left / 1000)}s (circuit breaker)`);
      err.code = 'HOST_COOLDOWN';
      throw err;
    }
    await sleep(left);
    now = Date.now();
  }
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL;
  if (wait > 0) await sleep(wait);
}

async function request(url, { method = 'GET', headers = {}, body = null, timeout = 30000 } = {}) {
  const host = hostOf(url);
  await gate(host);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, {
      method,
      headers: { 'Accept': 'application/json', 'Accept-Language': 'pt-BR,pt;q=0.9', 'User-Agent': DEFAULT_UA, ...headers },
      body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

/**
 * GET/POST → JSON. 204/404 → [] (ou null se allowEmpty). 429 aciona o breaker do
 * host (respeita Retry-After); 5xx faz backoff. Lança o último erro se esgotar.
 */
async function getJson(url, opts = {}) {
  const host = hostOf(url);
  const maxAttempts = Math.max(1, opts.maxAttempts || 4);
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await request(url, opts);
      if (res.status === 204 || res.status === 404) { noteSuccess(host); return opts.allowEmpty ? null : []; }
      if (res.status === 429) {
        const ra = parseInt(res.headers.get('retry-after') || '', 10);
        const backoff = trip429(host, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 0);
        lastErr = new Error(`HTTP 429 ${url}`);
        if (attempt < maxAttempts - 1) { await sleep(Math.min(GATE_WAIT_CAP_MS, backoff)); continue; }
        throw lastErr;
      }
      if (res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} ${url}`);
        if (attempt < maxAttempts - 1) { await sleep(Math.min(30000, 1000 * Math.pow(2, attempt))); continue; }
        throw lastErr;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const text = await res.text();
      noteSuccess(host);
      if (!text.trim()) return opts.allowEmpty ? null : [];
      return JSON.parse(text);
    } catch (e) {
      if (e.code === 'HOST_COOLDOWN') throw e;
      lastErr = e;
      if (attempt < maxAttempts - 1) await sleep(Math.min(15000, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

function httpStats() { return { throttle429, cooldowns: Object.fromEntries(cooldownByHost) }; }

module.exports = { request, getJson, sleep, DEFAULT_UA, httpStats, cooldownRemaining };
