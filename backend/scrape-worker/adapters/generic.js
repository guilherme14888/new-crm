// Adapter GENÉRICO de scraping — tenta capturar em QUALQUER portal por heurística
// (robô de tela Playwright). É BEST-EFFORT: cada portal tem layout próprio.
//
// Fluxo: 1) pré-check por HTTP (barato) detecta CAPTCHA / login / SPA-sem-busca e
// evita abrir o navegador à toa (registra a falha com o motivo). 2) Se parecer ter
// busca pública, abre o navegador, acha o campo de busca, digita a keyword, submete
// e lê os resultados. Portais que falharem ficam no log e podem ganhar um adapter
// DEDICADO depois (com os seletores certos).

const { matchesTerm } = require('../../src/ingest/normalize');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' }, signal: ctrl.signal });
    return await res.text();
  } finally { clearTimeout(t); }
}

// Classifica o portal pelo HTML inicial (sem navegador).
function classify(html) {
  const h = html || '';
  if (/recaptcha|g-recaptcha|hcaptcha|cf-challenge|turnstile|__cf_chl/i.test(h)) {
    return { ok: false, reason: 'CAPTCHA/anti-bot detectado — requer chave 2Captcha (Configurações → IA).' };
  }
  const hasSearch = /<(input|textarea)[^>]*(name|id|placeholder)=["'][^"']*(busca|pesquis|objeto|descri|palavra|termo|edital|licit|consulta|search)/i.test(h);
  if (hasSearch) return { ok: true };
  if (/type=["']password["']/i.test(h)) return { ok: false, reason: 'Requer login (campo de senha, sem busca pública).' };
  if (/__NEXT_DATA__|ng-version|data-reactroot|id=["'](root|app|__next)["']/i.test(h)) {
    return { ok: false, reason: 'SPA/JS sem busca server-rendered — requer adapter dedicado.' };
  }
  return { ok: false, reason: 'Sem campo de busca reconhecível na página inicial.' };
}

async function genericSweep(portal, keywords, opts = {}) {
  if (!portal.url) throw new Error('Portal sem URL configurada.');

  // 1) pré-check HTTP — barato, evita abrir o navegador para portais BLOQUEADOS
  //    (CAPTCHA/login/SPA). Se o fetch FALHAR (TLS estrito do Node em sites gov),
  //    NÃO desiste: deixa o navegador tentar (o Playwright lida melhor com TLS).
  let html = null;
  try { html = await fetchHtml(portal.url); } catch { html = null; }
  if (html) {
    const cls = classify(html);
    if (!cls.ok) throw new Error(cls.reason);
  }

  // 2) parece ter busca pública → abre o navegador e tenta capturar.
  const { newPage } = require('../lib/browser');
  const page = await newPage();
  const byKw = new Map();
  try {
    await page.goto(portal.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const searchSel = await page.evaluate(() => {
      const re = /busca|pesquis|objeto|descri|palavra|termo|edital|licit|consulta|search/i;
      const inputs = [...document.querySelectorAll('input[type="text"], input[type="search"], input:not([type]), textarea')];
      const cand = inputs.find((el) => re.test((el.name || '') + (el.id || '') + (el.placeholder || '') + (el.getAttribute('aria-label') || '')));
      if (!cand) return null;
      cand.setAttribute('data-scrape-q', '1');
      return '[data-scrape-q="1"]';
    });
    if (!searchSel) throw new Error('Campo de busca não localizado no DOM (refinar seletor com adapter dedicado).');

    for (const kw of keywords.slice(0, 6)) { // cap p/ não estourar tempo
      try {
        await page.fill(searchSel, kw.termo).catch(() => {});
        await page.press(searchSel, 'Enter').catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
        await sleep(700);
        const rows = await page.evaluate((termo) => {
          const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
          const t = norm(termo);
          const out = [];
          for (const el of document.querySelectorAll('table tr, li, [class*="result"], [class*="card"], [class*="item"]')) {
            const txt = (el.innerText || '').replace(/\s+/g, ' ').trim();
            if (txt.length > 20 && norm(txt).includes(t)) out.push({ txt: txt.slice(0, 280), link: (el.querySelector('a') || {}).href || null });
            if (out.length >= 40) break;
          }
          return out;
        }, kw.termo);
        const recs = rows.map((r) => ({
          fonte: portal.name, termoBusca: kw.termo, produto: kw.termo, produtoCandidato: kw.produtoCandidato ?? null,
          produtoLicitado: r.txt, lote: 1, item: 1,
          processoKey: `${portal.key}:${(r.link || r.txt).slice(0, 60)}`,
          externalKey: `${portal.key}:${(r.link || r.txt).slice(0, 80)}`,
          nomeSite: portal.name, urlSite: r.link || portal.url, encerramento: 'Recebendo propostas',
        })).filter((r) => matchesTerm(r.produtoLicitado, kw.termo));
        if (recs.length) {
          const g = byKw.get(kw.termo) || { kw, records: [] };
          g.records.push(...recs); byKw.set(kw.termo, g);
        }
        await sleep(400);
      } catch { /* próxima keyword */ }
    }
    if (byKw.size === 0) throw new Error('Busca executada, mas nenhum resultado reconhecido (layout precisa de adapter dedicado).');
  } finally {
    await page.close();
  }
  return [...byKw.values()];
}

module.exports = { genericSweep, classify, fetchHtml };
