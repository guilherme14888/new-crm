// Adapter de REFERÊNCIA — BEC-SP (Bolsa Eletrônica de Compras de São Paulo).
// Portal público ASP.NET sem API → coleta por navegador (Playwright).
//
// 🔴 ACHADO DA VALIDAÇÃO AO VIVO (2026-06-20): a consulta pública de Ofertas de
// Compra (https://www2.bec.sp.gov.br/bec_pregao_UI/OC/pregao_oc_pesquisa.aspx) é
// protegida por **reCAPTCHA** — o form tem `hdnRecaptchaToken` e `noRobot`. Logo,
// submeter a busca exige um TOKEN VÁLIDO de reCAPTCHA, que só se obtém com um
// SERVIÇO DE RESOLUÇÃO (ex.: 2Captcha) — custo por solve + sensível a ToS. Sem
// isso, a busca não retorna resultados. Decisão de negócio (custo/ToS) necessária
// antes de ativar este adapter.
//
// Campos REAIS do formulário (descobertos ao vivo) — úteis se houver decisão de
// integrar um solver de CAPTCHA:
//   ctl00$conteudo$Wuc_OC1$Wuc_filtroPesquisaOc1$cItemDescricao  → termo/produto
//   ctl00$conteudo$Wuc_OC1$Wuc_filtroPesquisaOc1$cMunicipio / cSecretaria / cTipoEdital
//   ctl00$conteudo$Wuc_OC1$c_btnPesquisa                          → botão pesquisar
//   ctl00$conteudo$Wuc_OC1$hdnRecaptchaToken / noRobot            → reCAPTCHA (bloqueio)
//
// O esqueleto abaixo é o fluxo; preencha o passo do CAPTCHA + o parsing da grade.

const { newPage, UA } = require('../lib/browser');
const { regiaoOf } = require('../../src/ingest/normalize');
const { hasKey, solveRecaptchaV2 } = require('../lib/captcha');

const CONSULTA_URL = 'https://www2.bec.sp.gov.br/bec_pregao_UI/OC/pregao_oc_pesquisa.aspx';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Resolve o reCAPTCHA da página e injeta o token nos campos esperados pelo ASP.NET.
async function resolverCaptcha(page) {
  // sitekey do widget reCAPTCHA (data-sitekey do .g-recaptcha, ou no HTML)
  const siteKey = await page.evaluate(() => {
    const el = document.querySelector('.g-recaptcha, [data-sitekey]');
    if (el) return el.getAttribute('data-sitekey');
    const m = document.documentElement.innerHTML.match(/sitekey["'\s:]+([0-9A-Za-z_-]{30,})/);
    return m ? m[1] : null;
  });
  if (!siteKey) return false;
  const token = await solveRecaptchaV2({ siteKey, pageUrl: CONSULTA_URL, invisible: true });
  await page.evaluate((t) => {
    const set = (sel) => document.querySelectorAll(sel).forEach((e) => { e.value = t; });
    set('[name$="hdnRecaptchaToken"]');
    set('#g-recaptcha-response');
    set('textarea[name="g-recaptcha-response"]');
    const nr = document.querySelector('[name$="noRobot"]'); if (nr) nr.value = 'true';
  }, token);
  return true;
}

async function sweep(keywords, opts = {}) {
  if (!(await hasKey())) {
    // Lança (não retorna vazio) p/ o runner registrar a FALHA com o motivo no log.
    throw new Error('CAPTCHA ausente — BEC-SP exige reCAPTCHA. Configure a chave 2Captcha em Configurações → IA.');
  }
  const page = await newPage();
  const byKw = new Map();
  try {
    for (const kw of keywords) {
      try {
        await page.goto(CONSULTA_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // 1) preenche o termo (descrição do item) — campo real do form BEC-SP
        await page.fill('input[name$="cItemDescricao"]', kw.termo).catch(() => {});

        // 2) resolve o reCAPTCHA (2Captcha) e injeta o token
        await resolverCaptcha(page);

        // 3) submete a pesquisa (botão real) e aguarda a grade
        await page.click('[name$="c_btnPesquisa"]').catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

        // 4) extrai as linhas da grade de resultados — AJUSTAR os seletores da grade
        //    ao DOM real (a página de resultados precisa ser inspecionada ao vivo):
        const linhas = await page.evaluate(() => {
          const out = [];
          document.querySelectorAll('table tr').forEach((tr) => {
            const tds = [...tr.querySelectorAll('td')].map((td) => td.textContent.trim());
            if (tds.length >= 4 && /\d/.test(tds[0])) {
              out.push({ numeroOC: tds[0], orgao: tds[1], objeto: tds[2], situacao: tds[3], url: tr.querySelector('a')?.href });
            }
          });
          return out;
        }).catch(() => []);

        // 5) mapeia para o shape normalizado:
        const records = linhas.map((l) => ({
          fonte: 'BEC-SP',
          termoBusca: kw.termo,
          produto: kw.termo,
          produtoCandidato: kw.produtoCandidato ?? null,
          licitador: l.orgao || null,
          uf: 'SP', regiao: regiaoOf('SP'),
          nProcesso: l.numeroOC || null,
          processoKey: `BECSP-${l.numeroOC || ''}`,
          externalKey: `BECSP-${l.numeroOC || ''}`,
          produtoLicitado: l.objeto || null,
          lote: 1, item: 1,
          etapaSessao: l.situacao || null,
          encerramento: /encerrad|homolog/i.test(l.situacao || '') ? 'Encerrado com vencedor' : 'Recebendo propostas',
          nomeSite: 'BEC-SP', urlSite: l.url || CONSULTA_URL,
        }));

        if (records.length) byKw.set(kw.termo, { kw, records });
        await sleep(1500); // ritmo educado entre termos
      } catch (e) {
        console.error(`[bec-sp] termo "${kw.termo}" falhou: ${e.message}`);
      }
    }
  } finally {
    await page.close();
  }
  return [...byKw.values()];
}

module.exports = { key: 'bec_sp', name: 'BEC-SP', kind: 'browser', sweep };
