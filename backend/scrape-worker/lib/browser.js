// Fábrica de navegador Playwright (carregado SOB DEMANDA — só os adapters do tipo
// 'browser' o usam; o framework e os adapters HTTP rodam sem Chromium).

let _browser = null;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function getBrowser() {
  if (_browser) return _browser;
  const { chromium } = require('playwright');
  _browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  return _browser;
}

/** Abre uma página nova num contexto pt-BR com UA de navegador. */
async function newPage() {
  const b = await getBrowser();
  const ctx = await b.newContext({ userAgent: UA, locale: 'pt-BR', viewport: { width: 1366, height: 768 } });
  return ctx.newPage();
}

async function closeBrowser() {
  if (_browser) { try { await _browser.close(); } catch { /* ignore */ } _browser = null; }
}

module.exports = { getBrowser, newPage, closeBrowser, UA };
