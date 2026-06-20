// Cliente HTTP compartilhado pelos conectores.
//
// Política do PNCP (que NÃO publica limite numérico): erramos para o lado seguro.
//   1) Taxa conservadora + serialização (1 chamada por vez via a "porta" gate()).
//   2) Circuit breaker: ao tomar 429, entra em COOLDOWN e nenhuma chamada sai até
//      passar (respeitando Retry-After). É o martelar após o 429 que vira penalidade.
//   3) Cooldown PERSISTIDO no banco (tabela ingest_throttle) → worker, execuções
//      manuais e reinícios respeitam a MESMA pausa (nunca somam carga).

const db = require('../db');

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Aguarda `ms` milissegundos. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Taxa global (conservadora por padrão) ───────────────────────────────────
// Sem limite oficial do PNCP, default baixo (~2 req/s). Ajustável via env, mas o
// circuit breaker é a real garantia de "nunca infringir".
const RATE_PER_SEC = Math.max(0.2, parseFloat(process.env.PNCP_RATE_PER_SEC || '2'));
const MIN_INTERVAL = 1000 / RATE_PER_SEC;
let nextSlot = 0;

// ── Circuit breaker / cooldown ──────────────────────────────────────────────
const HOST = 'pncp.gov.br';
const COOLDOWN_CAP_MS = 5 * 60 * 1000;   // teto do cooldown (5 min)
const GATE_WAIT_CAP_MS = 60 * 1000;      // se faltar mais que isto p/ sair do cooldown, aborta a chamada
let cooldownUntil = 0;                    // epoch ms (em memória)
let consecutive429 = 0;
let throttle429 = 0;
let lastDbSync = 0;

/** Lê o cooldown persistido (cross-process) — cacheado por 5s p/ não pesar. */
async function syncCooldownFromDb() {
  const now = Date.now();
  if (now - lastDbSync < 5000) return;
  lastDbSync = now;
  try {
    const [rows] = await db.query('SELECT cooldown_until FROM ingest_throttle WHERE host = ? LIMIT 1', [HOST]);
    if (rows[0] && rows[0].cooldown_until) {
      const until = new Date(rows[0].cooldown_until + 'Z').getTime();
      if (Number.isFinite(until) && until > cooldownUntil) cooldownUntil = until;
    }
  } catch { /* best-effort */ }
}

/** Persiste o cooldown para os outros processos respeitarem. */
async function saveCooldown(until, reason) {
  try {
    const iso = new Date(until).toISOString().slice(0, 19).replace('T', ' ');
    await db.query(
      `INSERT INTO ingest_throttle (host, cooldown_until, reason) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE cooldown_until = VALUES(cooldown_until), reason = VALUES(reason)`,
      [HOST, iso, (reason || '429').slice(0, 255)]
    );
  } catch { /* best-effort */ }
}

/** Registra um 429 e arma/estende o cooldown (respeita Retry-After). */
function trip429(retryAfterMs) {
  consecutive429++;
  throttle429++;
  const backoff = retryAfterMs && retryAfterMs > 0
    ? Math.min(COOLDOWN_CAP_MS, retryAfterMs)
    : Math.min(COOLDOWN_CAP_MS, 10000 * Math.pow(2, consecutive429 - 1)); // 10s,20s,40s… cap 5min
  const until = Date.now() + backoff;
  if (until > cooldownUntil) { cooldownUntil = until; saveCooldown(until, `429 x${consecutive429}`); }
  return backoff;
}
function noteSuccess() { consecutive429 = 0; }

/**
 * "Porta" pela qual TODA requisição passa: respeita o cooldown do breaker e a
 * taxa mínima. Se o cooldown for longo demais (> GATE_WAIT_CAP), lança erro para
 * a chamada abortar de forma limpa (o conector marca lacuna e tenta depois) — em
 * vez de bloquear por minutos.
 */
async function gate() {
  await syncCooldownFromDb();
  let now = Date.now();
  if (cooldownUntil > now) {
    const left = cooldownUntil - now;
    if (left > GATE_WAIT_CAP_MS) {
      const err = new Error(`PNCP em cooldown por mais ${Math.round(left / 1000)}s (circuit breaker)`);
      err.code = 'PNCP_COOLDOWN';
      throw err;
    }
    await sleep(left);
    now = Date.now();
  }
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL;
  if (wait > 0) await sleep(wait);
}

/** fetch com cabeçalhos padrão (UA de navegador), gate (taxa+cooldown) e timeout. */
async function request(url, { method = 'GET', headers = {}, body = null, timeout = 30000 } = {}) {
  await gate();
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
 * GET/POST que retorna JSON. 204/404 → [] (ou null se opts.allowEmpty). Em 429
 * aciona o circuit breaker e respeita Retry-After; em 5xx faz backoff. Corpo vazio
 * vira [] / null. Lança o último erro se esgotar as tentativas.
 */
async function getJson(url, opts = {}) {
  const maxAttempts = Math.max(1, opts.maxAttempts || 4);
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await request(url, opts);
      if (res.status === 204 || res.status === 404) { noteSuccess(); return opts.allowEmpty ? null : []; }
      if (res.status === 429) {
        const ra = parseInt(res.headers.get('retry-after') || '', 10);
        const backoff = trip429(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 0);
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
      noteSuccess();
      if (!text.trim()) return opts.allowEmpty ? null : [];
      return JSON.parse(text);
    } catch (e) {
      if (e.code === 'PNCP_COOLDOWN') throw e; // não insiste durante cooldown longo
      lastErr = e;
      if (attempt < maxAttempts - 1) await sleep(Math.min(15000, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

/** Métricas do cliente HTTP (observabilidade). */
function httpStats() { return { throttle429, cooldownUntil }; }

module.exports = { request, getJson, sleep, DEFAULT_UA, httpStats };
