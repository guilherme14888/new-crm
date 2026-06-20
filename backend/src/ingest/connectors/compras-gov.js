// Conector Compras.gov.br federal — REDUNDÂNCIA / FAILOVER do PNCP.
//
// O endpoint federal (dadosabertos.compras.gov.br) serve as MESMAS contratações
// 14.133 do PNCP, com o mesmo numeroControlePNCP — porém em OUTRO host/infra. Então
// quando o PNCP nos penaliza (429/cooldown), este conector mantém a coleta no ar.
//
// Para NÃO duplicar carga em dia normal, ele só roda quando o PNCP está em cooldown
// (failover automático). `force=true` ignora o gate (backfill manual). Captura em
// nível de cabeçalho (sem itens); quando o PNCP volta, a varredura dele re-enumera
// a janela e completa o detalhe item-a-item (a dedup funde por numeroControlePNCP).

const { getJson, cooldownRemaining } = require('../http');
const { normTxt, termTokens, mapStatus, toDateTime, regiaoOf, matchesTerm } = require('../normalize');
const { MED_RE, MODALIDADE_NOME } = require('./pncp-sweep');

const BASE = 'https://dadosabertos.compras.gov.br';
const PNCP_HOST = 'pncp.gov.br';
const MODALIDADES_DEFAULT = [6, 8, 9, 4];

const daysBefore = (isoDay, n) => { const b = new Date(`${isoDay}T00:00:00Z`); b.setUTCDate(b.getUTCDate() - n); return b.toISOString().slice(0, 10); };

function passaPreFiltro(objeto, keyTokens) {
  const t = normTxt(objeto || '');
  if (!t) return false;
  if (MED_RE.test(objeto || '')) return true;
  return keyTokens.some((tok) => t.includes(tok));
}

/** Enumera contratações federais 14.133 de uma modalidade na janela [di, df]. */
async function enumerar({ modalidade, di, df, stats }) {
  const out = []; const MAXP = 400; let pagina = 1; let total = null;
  while (pagina <= (total ?? pagina) && pagina <= MAXP) {
    const url = `${BASE}/modulo-contratacoes/1_consultarContratacoes_PNCP_14133` +
      `?pagina=${pagina}&tamanhoPagina=500&dataPublicacaoPncpInicial=${di}&dataPublicacaoPncpFinal=${df}&codigoModalidade=${modalidade}`;
    let data;
    try { data = await getJson(url, { allowEmpty: true }); }
    catch (e) { stats.enumErros = (stats.enumErros || 0) + 1; if (total === null) break; pagina++; continue; }
    const lote = (data && data.resultado) || [];
    out.push(...lote);
    if (total === null) { total = (data && data.totalPaginas) || 1; stats.enumerados = (stats.enumerados || 0) + ((data && data.totalRegistros) || lote.length); }
    if (!lote.length || pagina >= total) break;
    pagina++;
  }
  return out;
}

function toRecord(c, kw) {
  const controle = c.numeroControlePNCP || `${c.orgaoEntidadeCnpj}-${c.anoCompraPncp}-${c.sequencialCompraPncp}`;
  const venceu = !!(c.existeResultado || c.valorTotalHomologado);
  return {
    fonte: 'COMPRASGOV',
    termoBusca: kw.termo,
    produtoCandidato: kw.produtoCandidato ?? kw.produto_candidato ?? null,
    produto: kw.termo,
    pncpControle: controle,
    status: mapStatus(c.situacaoCompraNomePncp, c.dataAberturaPropostaPncp, venceu),
    licitador: c.orgaoEntidadeRazaoSocial || c.unidadeOrgaoNomeUnidade || null,
    cnpj: c.orgaoEntidadeCnpj || null,
    uf: c.unidadeOrgaoUfSigla || null, regiao: regiaoOf(c.unidadeOrgaoUfSigla),
    municipio: c.unidadeOrgaoMunicipioNome || null,
    nEdital: c.numeroCompra || null, nEditalOriginal: c.numeroCompra || null,
    nProcesso: c.processo || controle,
    modalidade: c.modalidadeNome || MODALIDADE_NOME[c.codigoModalidade] || null,
    tipoContratacao: c.tipoInstrumentoConvocatorioNome || null,
    produtoLicitado: c.objetoCompra || null,
    lote: 1, item: 1,
    precoEstimadoTotal: c.valorTotalEstimado != null ? Number(c.valorTotalEstimado) : null,
    precoFinalTotal: c.valorTotalHomologado != null ? Number(c.valorTotalHomologado) : null,
    dataHoraCertame: toDateTime(c.dataAberturaPropostaPncp || c.dataPublicacaoPncp),
    prazoEdital: toDateTime(c.dataEncerramentoPropostaPncp),
    etapaSessao: c.situacaoCompraNomePncp || null,
    encerramento: /cancelad|revogad|anulad/i.test(c.situacaoCompraNomePncp || '') ? 'Cancelado'
      : venceu ? 'Encerrado com vencedor' : 'Recebendo propostas',
    processoKey: controle, externalKey: controle,
    nomeSite: 'Compras.gov.br',
    urlSite: `https://pncp.gov.br/app/editais/${c.orgaoEntidadeCnpj}/${c.anoCompraPncp}/${c.sequencialCompraPncp}`,
  };
}

/** Failover: só coleta se o PNCP estiver em cooldown (ou force=true). */
async function sweep(keywords, opts = {}) {
  const cfg = opts.config || {};
  const force = String(cfg.force || process.env.COMPRASGOV_FORCE || '') === 'true';
  const stats = opts.stats || {};
  stats.enumerados = 0; stats.preFiltrados = 0; stats.comItemCasado = 0; stats.enumErros = 0; stats.byUf = {};

  const pncpDown = cooldownRemaining(PNCP_HOST) > 0;
  if (!pncpDown && !force) {
    console.log('[comprasgov] PNCP saudável — failover ocioso (não duplica carga).');
    return [];
  }
  console.log(`[comprasgov] FAILOVER ativo (${pncpDown ? 'PNCP em cooldown' : 'force=true'}).`);

  const runDate = opts.runDate || new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const lookback = parseInt(cfg.lookbackDays || process.env.SWEEP_LOOKBACK_DAYS || '3', 10);
  const modalidades = cfg.modalidades
    ? String(cfg.modalidades).split(',').map((x) => parseInt(x.trim(), 10)).filter(Boolean)
    : MODALIDADES_DEFAULT;
  const df = String(runDate).slice(0, 10);
  const di = daysBefore(runDate, lookback);
  const keyTokens = [...new Set(keywords.flatMap((k) => termTokens(k.termo)).filter((t) => t.length >= 5))];
  const byKw = new Map(); const seen = new Set();

  for (const modalidade of modalidades) {
    const lista = await enumerar({ modalidade, di, df, stats });
    for (const c of lista) {
      const ctrl = c.numeroControlePNCP || `${c.orgaoEntidadeCnpj}-${c.anoCompraPncp}-${c.sequencialCompraPncp}`;
      if (seen.has(ctrl)) continue; seen.add(ctrl);
      if (!passaPreFiltro(c.objetoCompra, keyTokens)) continue;
      stats.preFiltrados++;
      const kw = keywords.find((k) => matchesTerm(c.objetoCompra, k.termo));
      if (!kw) continue; // header-level: casa pelo objeto (o detalhe item-a-item vem do PNCP ao voltar)
      stats.comItemCasado++;
      const g = byKw.get(kw.termo) || { kw, records: [] };
      g.records.push(toRecord(c, kw)); byKw.set(kw.termo, g);
      const uf = c.unidadeOrgaoUfSigla || '??'; stats.byUf[uf] = (stats.byUf[uf] || 0) + 1;
    }
  }
  console.log(`[comprasgov] failover — enumerados ~${stats.enumerados}, pré ${stats.preFiltrados}, casados ${stats.comItemCasado}`);
  return [...byKw.values()];
}

module.exports = { name: 'Compras.gov (failover PNCP)', key: 'comprasgov', implemented: true, sweep };
