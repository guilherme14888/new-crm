// Conector Compras-CE — via API de Dados Abertos do TCE-CE (SIM). API PÚBLICA,
// sem autenticação. ESCOPO MUNICIPAL: o endpoint exige `codigo_municipio`, então
// a coleta é DIRIGIDA POR CONFIGURAÇÃO (lista de municípios). Sem municípios
// configurados → não faz nada (evita varrer os 184 e martelar a API).
//
// Os registros trazem `numero_id_contratacao_pncp` → quando presente, viram a
// chave de dedup (funde com o PNCP: fontes="PNCP,COMPRAS-CE").

const { getJson, sleep } = require('../http');
const { regiaoOf, mapStatus, toDateTime, matchesTerm, normTxt, termTokens } = require('../normalize');
const { MED_RE } = require('./pncp-sweep');

const BASE = 'https://api-dados-abertos.tce.ce.gov.br/sim';

const daysBefore = (isoDay, n) => { const b = new Date(`${isoDay}T00:00:00Z`); b.setUTCDate(b.getUTCDate() - n); return b.toISOString().slice(0, 10); };

// Cache nome do município (code → nome), carregado uma vez.
let muniCache = null;
async function ensureMunis() {
  if (muniCache) return;
  muniCache = {};
  try {
    const d = await getJson(`${BASE}/municipios?%24count=1000`, { allowEmpty: true });
    (d && d.elements || []).forEach((m) => { muniCache[m.codigo_municipio] = m.nome_municipio; });
  } catch { /* segue sem nomes */ }
}
async function muniName(code) { await ensureMunis(); return muniCache[code] || null; }
/** Todos os códigos de município do CE (exclui 001 = T.C.M., que não é município). */
async function todosMunicipios() {
  await ensureMunis();
  return Object.keys(muniCache).filter((c) => c && c !== '001');
}

function passaPreFiltro(objeto, keyTokens) {
  const t = normTxt(objeto || '');
  if (!t) return false;
  if (MED_RE.test(objeto || '')) return true;
  return keyTokens.some((tok) => t.includes(tok));
}

async function recordsDoMunicipio({ code, di, df, stats }) {
  const out = [];
  let start = 0; const PAGE = 1000; const MAXP = 20;
  for (let p = 0; p < MAXP; p++) {
    const url = `${BASE}/processos_administrativos_contratacoes` +
      `?codigo_municipio=${encodeURIComponent(code)}&data_inicio=${di}&data_fim=${df}&%24count=${PAGE}&%24start_index=${start}`;
    let data;
    try { data = await getJson(url, { allowEmpty: true }); }
    catch { stats.enumErros = (stats.enumErros || 0) + 1; break; }
    const els = (data && data.elements) || [];
    out.push(...els);
    if (els.length < PAGE) break;
    start += PAGE;
    await sleep(150);
  }
  return out;
}

async function toRecord(r, kw) {
  const pncp = r.numero_id_contratacao_pncp || null;
  const proc = r.numero_licitacao || `${r.codigo_municipio}-${r.data_realizacao_autuacao_licitacao || ''}`;
  const venceu = !!r.data_homologacao;
  return {
    fonte: 'COMPRAS-CE',
    termoBusca: kw.termo,
    produtoCandidato: kw.produtoCandidato ?? kw.produto_candidato ?? null,
    produto: kw.termo,
    pncpControle: pncp,
    status: mapStatus(r.tipo_licitacao, r.data_realizacao_licitacao, venceu),
    licitador: r.nome_orgao_ata || (await muniName(r.codigo_municipio)) || `Município CE ${r.codigo_municipio}`,
    uf: 'CE', regiao: regiaoOf('CE'),
    municipio: await muniName(r.codigo_municipio),
    nEdital: r.numero_licitacao || null, nEditalOriginal: r.numero_licitacao || null,
    nProcesso: proc,
    processoKey: pncp || `CE${r.codigo_municipio}-${proc}`,
    externalKey: pncp || `CE${r.codigo_municipio}-${proc}`,
    modalidade: r.modalidade_licitacao ? `CE-${r.modalidade_licitacao}` : null,
    produtoLicitado: r.descricao_objeto_licitacao || null,
    lote: 1, item: 1,
    precoEstimadoTotal: r.valor_orcado_estimado != null ? Number(r.valor_orcado_estimado) : null,
    dataHoraCertame: toDateTime(r.data_realizacao_licitacao || r.data_realizacao_autuacao_licitacao),
    prazoEdital: toDateTime(r.data_emissao_edital),
    etapaSessao: venceu ? 'Homologada' : null,
    encerramento: venceu ? 'Encerrado com vencedor' : 'Recebendo propostas',
    nomeSite: 'TCE-CE (SIM)',
    urlSite: r.descricao_url_plataforma_contratacao || 'https://api-dados-abertos.tce.ce.gov.br',
  };
}

/** Varredura dos municípios configurados, casando o objeto contra as keywords. */
async function sweep(keywords, opts = {}) {
  const cfg = opts.config || {};
  const stats = opts.stats || {};
  stats.enumerados = 0; stats.preFiltrados = 0; stats.comItemCasado = 0; stats.enumErros = 0; stats.byUf = {};

  let municipios = String(cfg.municipios || process.env.COMPRAS_CE_MUNICIPIOS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  // "all"/"todos" → varre TODOS os municípios do CE (devagar, mas completo).
  if (municipios.length === 1 && /^(all|todos)$/i.test(municipios[0])) {
    municipios = await todosMunicipios();
    console.log(`[compras-ce] TODOS os ${municipios.length} municípios do CE (coleta lenta e completa).`);
  }
  if (!municipios.length) {
    console.log('[compras-ce] sem municípios configurados — nada a coletar (use `municipios=all` para todos).');
    return [];
  }

  const runDate = opts.runDate || new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const lookback = parseInt(cfg.lookbackDays || '30', 10); // CE é por autuação; janela maior
  const pausa = parseInt(cfg.pausaMs || '400', 10); // ritmo educado entre municípios
  const df = String(runDate).slice(0, 10);
  const di = daysBefore(runDate, lookback);
  const keyTokens = [...new Set(keywords.flatMap((k) => termTokens(k.termo)).filter((t) => t.length >= 5))];
  const byKw = new Map();

  let i = 0;
  for (const code of municipios) {
    const els = await recordsDoMunicipio({ code, di, df, stats });
    stats.enumerados += els.length;
    if (++i % 25 === 0) console.log(`[compras-ce] ${i}/${municipios.length} municípios processados…`);
    await sleep(pausa);
    for (const r of els) {
      const objeto = r.descricao_objeto_licitacao || '';
      if (!passaPreFiltro(objeto, keyTokens)) continue;
      stats.preFiltrados++;
      const kw = keywords.find((k) => matchesTerm(objeto, k.termo));
      if (!kw) continue;
      stats.comItemCasado++;
      const rec = await toRecord(r, kw);
      const g = byKw.get(kw.termo) || { kw, records: [] };
      g.records.push(rec); byKw.set(kw.termo, g);
      stats.byUf.CE = (stats.byUf.CE || 0) + 1;
    }
  }
  console.log(`[compras-ce] municípios ${municipios.length} — enumerados ${stats.enumerados}, pré ${stats.preFiltrados}, casados ${stats.comItemCasado}`);
  return [...byKw.values()];
}

module.exports = { name: 'Compras CE (TCE-CE)', key: 'compras_ce', implemented: true, sweep };
