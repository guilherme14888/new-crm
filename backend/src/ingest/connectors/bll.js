// BLL / BLLCompras — Web Service SOAP de RESULTADOS (lanceinteg.com/ProcessResult.svc).
// ATENÇÃO: integração do ÓRGÃO PROMOTOR. NÃO há busca por palavra-chave — só puxa
// dados de um processo cujo NÚMERO você já conhece, usando uma `orgKey`.
// Por isso o BLL participa via `collect()` (lista de processos a acompanhar).
//
// Config (Configurações → API Externa, ou .env de fallback):
//   org_key   = chave de integração do órgão promotor
//   ws_url    = https://lanceinteg.com/ProcessResult.svc (padrão)
//   processes = JSON: [{ "number":"005/2016","modalityId":1,"agency":"...","uf":"PR","cnpj":"..." }]

const db = require('../../db');
const { numOrNull, regiaoOf } = require('../normalize');

const DEFAULT_WS = 'https://lanceinteg.com/ProcessResult.svc';
const NS = 'http://tempuri.org/';

/** Aceita array ou string JSON e devolve a lista de processos a acompanhar. */
function parseProcesses(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}

// ── SOAP helpers ─────────────────────────────────────────────────────────────
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dec = (s) => String(s == null ? '' : s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');

/** Faz uma chamada SOAP (WCF) ao ProcessResult.svc e devolve o XML de resposta. */
async function soap(wsUrl, method, inner) {
  const envelope =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>` +
    `<${method} xmlns="${NS}">${inner}</${method}>` +
    `</s:Body></s:Envelope>`;
  const res = await fetch(wsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `${NS}IProcessResult/${method}`,
      'User-Agent': 'crm-br4-ingest/1.0',
    },
    body: envelope,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SOAP ${method} HTTP ${res.status}`);
  return text;
}

function field(block, name) {
  const m = block.match(new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)</(?:\\w+:)?${name}>`));
  return m ? dec(m[1]) : null;
}
function blocks(xml, typeName) {
  const re = new RegExp(`<(?:\\w+:)?${typeName}>([\\s\\S]*?)</(?:\\w+:)?${typeName}>`, 'g');
  const out = []; let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}
function blocksToObjs(xml, typeName, fields) {
  return blocks(xml, typeName).map((b) => {
    const o = {};
    for (const f of fields) o[f] = field(b, f);
    return o;
  });
}

async function getProcessId(wsUrl, orgKey, number, modalityId) {
  const xml = await soap(wsUrl, 'GetProcessIdByNumber',
    `<orgKey>${esc(orgKey)}</orgKey><processNumber>${esc(number)}</processNumber><modalityId>${esc(modalityId)}</modalityId>`);
  const id = field(xml, 'GetProcessIdByNumberResult');
  return id && !/^0{8}-0{4}/.test(id) ? id : null;
}
async function getList(wsUrl, orgKey, method, processId) {
  return soap(wsUrl, method, `<orgKey>${esc(orgKey)}</orgKey><processId>${esc(processId)}</processId>`);
}

// ── collect() ─────────────────────────────────────────────────────────────────
async function collect(opts = {}) {
  const config = opts.config || {};
  const orgKey = config.org_key || null;
  const wsUrl = config.ws_url || DEFAULT_WS;
  const procs = parseProcesses(config.processes);
  if (!orgKey || !procs.length) return [];

  const [kws] = await db.query('SELECT termo, produto_candidato FROM market_intelligence_keywords WHERE ativo = 1');
  const classify = (desc) => {
    const d = (desc || '').toLowerCase();
    const hit = kws.find((k) => d.includes(String(k.termo).toLowerCase()));
    return hit ? hit.produto_candidato : null;
  };

  const out = [];
  for (const p of procs) {
    let processId;
    try { processId = await getProcessId(wsUrl, orgKey, p.number, p.modalityId); } catch { continue; }
    if (!processId) continue;

    let items = [], ranking = [], finals = [], people = [];
    try { items   = blocksToObjs(await getList(wsUrl, orgKey, 'GetBatchItems', processId), 'BatchItemData',
      ['BatchNumber', 'ItemNumber', 'Description', 'Unity', 'Quantity', 'BaseValue', 'AdditionalInfo']); } catch {}
    try { ranking = blocksToObjs(await getList(wsUrl, orgKey, 'GetRankingByProcess', processId), 'RankingData',
      ['BatchNumber', 'Document', 'IsMeEpp', 'RankingPos', 'BidValue']); } catch {}
    try { finals  = blocksToObjs(await getList(wsUrl, orgKey, 'GetFinalUnitValueByProcess', processId), 'FinalUnitData',
      ['BatchNumber', 'ItemNumber', 'Value']); } catch {}
    try { people  = blocksToObjs(await getList(wsUrl, orgKey, 'GetParticipantsByProcess', processId), 'PersonData',
      ['Name', 'Document1']); } catch {}

    const nameByDoc = {};
    for (const pe of people) nameByDoc[(pe.Document1 || '').replace(/\D/g, '')] = pe.Name;
    const winnerByBatch = {};
    for (const r of ranking) {
      const b = String(r.BatchNumber);
      if (parseInt(r.RankingPos, 10) === 1 || !winnerByBatch[b]) winnerByBatch[b] = r;
    }
    const finalByKey = {};
    for (const f of finals) finalByKey[`${f.BatchNumber}#${f.ItemNumber}`] = numOrNull(f.Value);

    for (const it of items) {
      const win = winnerByBatch[String(it.BatchNumber)];
      const doc = win ? (win.Document || '').replace(/\D/g, '') : null;
      out.push({
        fonte: 'BLL',
        status: 'Encerrado',
        regiao: regiaoOf(p.uf),
        cnpj: p.cnpj || null,
        licitador: p.agency || null,
        uf: p.uf || null,
        municipio: p.city || null,
        nEdital: p.number,
        nProcesso: p.number,
        modalidade: p.modalidade || null,
        nomeSite: 'BLL',
        urlSite: p.url || 'https://bll.org.br',
        lote: numOrNull(it.BatchNumber),
        item: numOrNull(it.ItemNumber),
        produtoCandidato: classify(it.Description),
        produto: it.AdditionalInfo || null,
        produtoLicitado: it.Description || null,
        quantidade: numOrNull(it.Quantity),
        unidadeOriginal: it.Unity || null,
        precoEstimadoUnit: numOrNull(it.BaseValue),
        posicao: win ? numOrNull(win.RankingPos) : null,
        concorrente: doc ? (nameByDoc[doc] || null) : null,
        cnpjConcorrente: doc || null,
        precoFinalUnit: finalByKey[`${it.BatchNumber}#${it.ItemNumber}`] ?? (win ? numOrNull(win.BidValue) : null),
        etapaSessao: 'Homologado',
        processoKey: p.number,
        externalKey: `bll:${p.number}:${it.BatchNumber}:${it.ItemNumber}`,
      });
    }
  }
  return out;
}

module.exports = { name: 'BLL', key: 'bll', implemented: true, collect };
