// Conector Compras-ES (SIGA) — via Portal de Dados Abertos do ES (CKAN).
// API PÚBLICA, sem autenticação: `datastore_search` com busca full-text `q`.
// O dado é licitação-a-licitação (sem itens), então casamos o termo contra o
// `Objeto`. Fonte aditiva ao PNCP (cobertura/histórico próprios do estado).
//
// Granularidade: 1 registro por licitação (não há quebra por item/lote nem
// resultado/concorrente). A dedupe_key usa processoKey="ES-<IdLicitacao>" →
// nunca duplica dentro do ES; reexecutar é idempotente.

const { getJson } = require('../http');
const { regiaoOf, mapStatus, toDateTime, matchesTerm } = require('../normalize');

const CKAN = 'https://dados.es.gov.br/api/3/action';
// Recurso "Licitações" do dataset de compras públicas do ES. O ES publica um
// recurso por ano — troque via config (resource_id) ou env quando virar o ano.
const DEFAULT_RESOURCE = 'e48980a6-347b-4285-8b29-11d8210fc0a5';

// "02/01/2025 11:34:22" → "2025-01-02T11:34:22" (ISO, p/ o toDateTime).
function brToIso(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, d, mo, y, h = '00', mi = '00', se = '00'] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${se}`;
}

// Situação textual do SIGA → "encerramento" padronizado do pipeline.
function encFrom(sit) {
  const s = (sit || '').toLowerCase();
  if (/encerrad|homologad|adjudicad|conclu/.test(s)) return 'Encerrado com vencedor';
  if (/cancelad|revogad|anulad|fracassad|desert/.test(s)) return 'Cancelado';
  if (/abert|andamento|public|recebend/.test(s)) return 'Recebendo propostas';
  return sit || null;
}

/** Busca licitações do ES cujo objeto casa com a palavra-chave. */
async function search(kw, opts = {}) {
  const cfg = opts.config || {};
  const resource = cfg.resource_id || process.env.COMPRAS_ES_RESOURCE || DEFAULT_RESOURCE;
  const limit = Math.min(500, opts.size || 100);
  const url = `${CKAN}/datastore_search?resource_id=${encodeURIComponent(resource)}` +
    `&q=${encodeURIComponent(kw.termo)}&limit=${limit}`;

  let data;
  try { data = await getJson(url, { allowEmpty: true }); } catch { return []; }
  const recs = (data && data.result && data.result.records) || [];

  const out = [];
  for (const r of recs) {
    const objeto = r.Objeto || '';
    if (!matchesTerm(objeto, kw.termo)) continue; // `q` é fuzzy → confirma no Objeto
    const idLic = r.IdLicitacao || r.Id || r._id;
    const proc = r.NumeroProcesso || String(idLic);
    out.push({
      fonte: 'COMPRAS-ES',
      termoBusca: kw.termo,
      produtoCandidato: kw.produtoCandidato ?? kw.produto_candidato ?? null,
      produto: kw.termo,
      status: mapStatus(r.Situacao, brToIso(r.DataAbertura), /encerrad|homolog/i.test(r.Situacao || '')),
      licitador: r.NomeOrgao || null,
      uf: 'ES', regiao: regiaoOf('ES'),
      nProcesso: proc, nEdital: proc, nEditalOriginal: proc,
      processoKey: `ES-${idLic}`, externalKey: `ES-${idLic}`,
      modalidade: r.Modalidade || null,
      tipoContratacao: r.TipoLicitacao || null,
      produtoLicitado: objeto,
      lote: 1, item: 1,
      dataHoraCertame: toDateTime(brToIso(r.DataAbertura || r.DataCriacao)),
      prazoEdital: toDateTime(brToIso(r.DataAbertura)),
      etapaSessao: r.Situacao || null,
      encerramento: encFrom(r.Situacao),
      nomeSite: 'Compras ES (SIGA)',
      urlSite: 'https://compras.es.gov.br/',
    });
  }
  return out;
}

module.exports = { name: 'Compras ES (SIGA)', key: 'compras_es', implemented: true, mode: 'keyword', search };
