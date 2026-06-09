// Cliente HTTP compartilhado pelos conectores: User-Agent de navegador (vários
// portais têm WAF), timeout, 1 retry e parse JSON tolerante a corpo vazio.

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Aguarda `ms` milissegundos (usado para throttle entre requisições). */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch com cabeçalhos padrão (UA de navegador) e timeout via AbortController. */
async function request(url, { method = 'GET', headers = {}, body = null, timeout = 30000 } = {}) {
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
 * GET/POST que retorna JSON, com 1 retry. 204/404 → [] (ou null se opts.allowEmpty).
 * Corpo vazio também vira [] / null. Lança o último erro se as tentativas falharem.
 */
async function getJson(url, opts = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await request(url, opts);
      if (res.status === 204 || res.status === 404) return opts.allowEmpty ? null : [];
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const text = await res.text();
      if (!text.trim()) return opts.allowEmpty ? null : [];
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

module.exports = { request, getJson, sleep, DEFAULT_UA };
