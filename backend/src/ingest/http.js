// Cliente HTTP compartilhado pelos conectores: User-Agent de navegador (vários
// portais têm WAF), timeout, throttle global por taxa e retry com backoff que
// honra 429/Retry-After (o PNCP rate-limita agressivamente em escala).

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Aguarda `ms` milissegundos (usado para throttle entre requisições). */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Throttle global por taxa ────────────────────────────────────────────────
// TODAS as chamadas (enumeração E download de itens) passam por aqui, garantindo
// uma taxa máxima sustentada para o host do PNCP — independente de quantos loops
// (tenants × keywords) estejam rodando. Evita a cascata de 429.
const RATE_PER_SEC = Math.max(1, parseInt(process.env.PNCP_RATE_PER_SEC || '5', 10));
const MIN_INTERVAL = 1000 / RATE_PER_SEC;
let nextSlot = 0;
let throttle429 = 0; // contador de 429 observados (observabilidade)
async function gate() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL;
  if (wait > 0) await sleep(wait);
}

/** fetch com cabeçalhos padrão (UA de navegador), throttle global e timeout. */
async function request(url, { method = 'GET', headers = {}, body = null, timeout = 30000 } = {}) {
  await gate();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, {
      method,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': DEFAULT_UA,
        ...headers,
      },
      body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

/**
 * GET/POST que retorna JSON, com retry resiliente. 204/404 → [] (ou null se
 * opts.allowEmpty). Em 429/5xx faz backoff exponencial honrando Retry-After.
 * Corpo vazio também vira [] / null. Lança o último erro se esgotar as tentativas.
 */
async function getJson(url, opts = {}) {
  const maxAttempts = Math.max(1, opts.maxAttempts || 5);
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await request(url, opts);
      if (res.status === 204 || res.status === 404) return opts.allowEmpty ? null : [];
      if (res.status === 429 || res.status >= 500) {
        if (res.status === 429) throttle429++;
        lastErr = new Error(`HTTP ${res.status} ${url}`);
        if (attempt < maxAttempts - 1) {
          const ra = parseInt(res.headers.get('retry-after') || '', 10);
          const backoff = Number.isFinite(ra) && ra > 0
            ? Math.min(60000, ra * 1000)
            : Math.min(30000, 1000 * Math.pow(2, attempt));
          await sleep(backoff);
          continue;
        }
        throw lastErr;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const text = await res.text();
      if (!text.trim()) return opts.allowEmpty ? null : [];
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts - 1) await sleep(Math.min(15000, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

/** Métricas do cliente HTTP (para logs de observabilidade). */
function httpStats() { return { throttle429 }; }

module.exports = { request, getJson, sleep, DEFAULT_UA, httpStats };
