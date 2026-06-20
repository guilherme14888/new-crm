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

const CONSULTA_URL = 'https://www2.bec.sp.gov.br/bec_pregao_UI/OC/pregao_oc_pesquisa.aspx';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sweep(keywords, opts = {}) {
  const page = await newPage();
  const byKw = new Map();
  try {
    for (const kw of keywords) {
      try {
        await page.goto(CONSULTA_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // 1) preencher o termo e submeter a busca — AJUSTAR seletores ao DOM real:
        //    await page.fill('input[name$="txtObjeto"]', kw.termo);
        //    await page.click('input[name$="btnPesquisar"]');
        //    await page.waitForSelector('table[id$="grdResultado"]', { timeout: 30000 });

        // 2) extrair as linhas da grade de resultados — AJUSTAR:
        //    const linhas = await page.$$eval('table[id$="grdResultado"] tr.linha', trs => trs.map(tr => ({
        //      numeroOC: tr.querySelector('.oc')?.textContent?.trim(),
        //      orgao:    tr.querySelector('.orgao')?.textContent?.trim(),
        //      objeto:   tr.querySelector('.objeto')?.textContent?.trim(),
        //      abertura: tr.querySelector('.abertura')?.textContent?.trim(),
        //      situacao: tr.querySelector('.situacao')?.textContent?.trim(),
        //      url:      tr.querySelector('a')?.href,
        //    })));
        const linhas = []; // ← preencher com o parsing real

        // 3) (opcional) abrir cada OC p/ detalhe: abertura, vencedor, datas, encerramento
        //    e mapear para o shape normalizado:
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
