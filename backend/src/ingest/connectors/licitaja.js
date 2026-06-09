// Licitaja (https://www.licitaja.com.br/api/v1) — API REST oficial (OpenAPI 3.0.3).
// Busca por palavra-chave: GET /tender/search?keyword=...  (header X-API-KEY).
// Spec: https://app.swaggerhub.com/apis-docs/bidhits/licitaja-br/
//
// Credencial via .env: LICITAJA_API_KEY  (gerada na conta Licitaja).
//   - sem a key a API responde resultados parciais; com a key, completos.
// Base configurável: LICITAJA_BASE (padrão Brasil).

const { getJson } = require('../http');
const { regiaoOf, numOrNull } = require('../normalize');

const DEFAULT_BASE = 'https://www.licitaja.com.br/api/v1';

/** "R$ 1.234,56" (ou número) → 1234.56. */
function money(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
/** "YYYYmmdd" ou ISO → "YYYY-MM-DD HH:MM:SS" (DATETIME do MySQL). */
function toDt(v) {
  if (!v) return null;
  let d;
  if (/^\d{8}$/.test(String(v))) d = new Date(`${String(v).slice(0, 4)}-${String(v).slice(4, 6)}-${String(v).slice(6, 8)}T00:00:00Z`);
  else d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
/** Status pela data de encerramento (futura → Novo; passada → Encerrado). */
function statusFrom(closeDate) {
  if (!closeDate) return 'Em Andamento';
  return new Date(closeDate).getTime() > Date.now() ? 'Novo' : 'Encerrado';
}

/** Busca licitações na API da Licitaja por palavra-chave (X-API-KEY) e normaliza. */
async function search(keyword, opts = {}) {
  const { pages = 5, size = 25, config = {} } = opts;
  const BASE = (config.base_url || DEFAULT_BASE).replace(/\/$/, '');
  const API_KEY = config.api_key || null;
  const termo = keyword.termo;
  const produtoCandidato = keyword.produtoCandidato ?? keyword.produto_candidato ?? null;
  const items = Math.min(size, 25); // máximo da API
  const headers = API_KEY ? { 'X-API-KEY': API_KEY } : {};
  const out = [];

  for (let page = 1; page <= pages; page++) {
    const url = `${BASE}/tender/search?keyword=${encodeURIComponent(termo)}&page=${page}&items=${items}`;
    const data = await getJson(url, { headers, allowEmpty: true });
    if (!data) break;
    const list = Array.isArray(data) ? data : (data.results || data.tenders || data.data || []);
    if (!Array.isArray(list) || list.length === 0) break;

    for (const t of list) {
      const closeDate = t.close_date || t.opening_date || null;
      // identificador estável (com a key vem tenderId/process; sem ela, a url é única)
      const ident = t.process || t.number || (t.tenderId != null ? String(t.tenderId) : null) || t.url;
      if (!ident) continue;
      out.push({
        fonte: 'LICITAJA',
        termoBusca: termo,
        status: statusFrom(closeDate),
        regiao: regiaoOf(t.state),
        cnpj: t.agency_document || t.cnpj || null, // pode não vir; dedupe cai no nº do processo
        licitador: t.agency || null,
        uf: t.state || null,
        municipio: t.city || null,
        nEdital: t.number || t.number2 || null,
        nProcesso: ident,
        modalidade: t.type || t.nature || t.procurement || null,
        nomeSite: t.biddingPlatform || 'Licitaja',
        urlSite: t.url || t.url2 || null,
        dataHoraCertame: toDt(closeDate),
        prazoEdital: toDt(t.close_date),
        // 1 linha por licitação (estrutura de `lots` será expandida quando tivermos
        // a key e enxergarmos o schema real dos lotes/itens).
        lote: 1,
        item: 1,
        produtoCandidato,
        produto: termo,
        produtoLicitado: t.tender_object || null,
        quantidade: null,
        precoEstimadoTotal: money(t.value),
        etapaSessao: t.nature || null,
        processoKey: ident,
        externalKey: `licitaja:${t.tenderId != null ? t.tenderId : ident}`,
      });
    }
    if (list.length < items) break;
  }
  return out;
}

module.exports = { name: 'LICITAJA', key: 'licitaja', implemented: true, search };
