// Conector PNCP-Sweep — VARREDURA COMPLETA (garantia de cobertura).
//
// Diferença vs. o conector 'pncp' (busca textual /api/search/?q=):
//   • 'pncp' depende do índice de busca do PNCP por palavra-chave → recall NÃO
//     garantido (editais com descrição diferente, atraso de indexação, etc. somem).
//   • 'pncp_sweep' ENUMERA todas as contratações publicadas numa janela, por
//     modalidade (API /consulta/v1/contratacoes/publicacao), e classifica os itens
//     LOCALMENTE. Como lemos o texto de cada item nós mesmos, o recall é total
//     sobre o que o PNCP publicou — que, por lei (Art. 174/14.133), é o superconjunto
//     que TODOS os portais (BLL, Licitanet, BNC…) são obrigados a alimentar.
//
// Funil de custo (decisão: pré-filtrar medicamentos antes da IA):
//   1) Enumera contratações (1 chamada por página, barato).
//   2) Pré-filtro de MEDICAMENTO sobre `objetoCompra` (descarta obra/merenda/etc.)
//      → controla volume sem perder editais de medicamento.
//   3) Só então baixa itens e casa contra as keywords do tenant (full recall local).
//   4) Os itens que casam seguem pelo pipeline normal (relevância T0–T3 → upsert).

const { getJson, sleep } = require('../http');
const { BASE, fetchCompraRecords } = require('./pncp-core');
const { normTxt, termTokens } = require('../normalize');

// Modalidades onde medicamentos efetivamente aparecem (código PNCP → nome).
// Default focado; pode ser ampliado via config.modalidades = "4,6,8,9,12".
const MODALIDADE_NOME = {
  1: 'Leilão - Eletrônico', 2: 'Diálogo Competitivo', 3: 'Concurso',
  4: 'Concorrência - Eletrônica', 5: 'Concorrência - Presencial',
  6: 'Pregão - Eletrônico', 7: 'Pregão - Presencial', 8: 'Dispensa de Licitação',
  9: 'Inexigibilidade', 10: 'Manifestação de Interesse', 11: 'Pré-qualificação',
  12: 'Credenciamento', 13: 'Leilão - Presencial',
};
const MODALIDADES_DEFAULT = [6, 8, 9, 4]; // Pregão-e, Dispensa, Inexigibilidade, Concorrência-e

// Vocabulário de medicamento (pré-filtro barato no objeto da compra). Generoso de
// propósito — preferimos pagar alguns itens a mais do que perder um edital.
const MED_RE = /medicament|f[aá]rmac|farmac[êe]utic|insumo|quimioter|oncolog|antineopl|terap[êe]utic|princ[ií]pio ativo|antibiot|imunobiol|vacina|soro\b|drug/i;

const YYYYMMDD = (d) => String(d).slice(0, 10).replace(/-/g, '');
function daysBefore(isoDay, n) {
  const base = new Date(`${isoDay}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - n);
  return base.toISOString().slice(0, 10);
}

/** O objeto da compra "parece medicamento" OU cita diretamente alguma keyword? */
function passaPreFiltro(objeto, keyTokens) {
  const t = normTxt(objeto || '');
  if (!t) return false;
  if (MED_RE.test(objeto || '')) return true;
  return keyTokens.some((tok) => t.includes(tok)); // cita o princípio ativo no objeto
}

/**
 * Enumera todas as contratações de uma modalidade na janela [dataInicial, dataFinal].
 * Pagina até o fim (com teto de segurança). Devolve a lista bruta (data[]).
 */
async function enumerarModalidade({ modalidade, dataInicial, dataFinal, delay, stats }) {
  const out = [];
  const MAX_PAGINAS = 1000; // backstop anti-loop
  let pagina = 1;
  while (pagina <= MAX_PAGINAS) {
    const url = `${BASE}/api/consulta/v1/contratacoes/publicacao` +
      `?dataInicial=${dataInicial}&dataFinal=${dataFinal}` +
      `&codigoModalidadeContratacao=${modalidade}&pagina=${pagina}`;
    let data;
    try {
      data = await getJson(url, { allowEmpty: true });
    } catch (e) {
      stats.enumErros = (stats.enumErros || 0) + 1;
      console.error(`[sweep] enumeração modalidade ${modalidade} pág ${pagina} falhou: ${e.message}`);
      break; // não trava a varredura inteira por causa de uma modalidade/página
    }
    const lote = (data && data.data) || [];
    out.push(...lote);
    const totalPaginas = (data && (data.totalPaginas || data.totalPages)) || 1;
    if (pagina === 1) stats.enumerados = (stats.enumerados || 0) + ((data && data.totalRegistros) || lote.length);
    if (lote.length === 0 || pagina >= totalPaginas) break;
    pagina++;
    await sleep(delay);
  }
  if (pagina >= MAX_PAGINAS) console.warn(`[sweep] modalidade ${modalidade}: teto de ${MAX_PAGINAS} páginas atingido — possível truncamento.`);
  return out;
}

/** Extrai os campos de cabeçalho que o pncp-core precisa, da entrada da enumeração. */
function metaFromListing(c) {
  const org = c.orgaoEntidade || c.orgaoSubRogado || {};
  const uni = c.unidadeOrgao || {};
  return {
    numeroControlePNCP: c.numeroControlePNCP,
    objetoCompra: c.objetoCompra,
    dataAtualizacao: c.dataAtualizacaoGlobal || c.dataAtualizacao,
    dataPublicacaoPncp: c.dataPublicacaoPncp,
    dataAberturaProposta: c.dataAberturaProposta,
    dataEncerramentoProposta: c.dataEncerramentoProposta,
    situacaoNome: c.situacaoCompraNome || c.situacaoCompra,
    temResultado: !!(c.temResultado || c.valorTotalHomologado),
    cancelado: /cancelad|revogad|anulad/i.test(c.situacaoCompraNome || ''),
    orgaoCnpj: org.cnpj,
    orgaoNome: org.razaoSocial,
    unidadeNome: uni.nomeUnidade,
    uf: uni.ufSigla,
    municipioNome: uni.municipioNome,
    numeroCompra: c.numeroCompra,
    numeroProcesso: c.numeroProcesso,
    modalidadeNome: c.modalidadeNome || MODALIDADE_NOME[c.modalidadeId] || null,
    tipoInstrumento: c.tipoInstrumentoConvocatorioNome,
  };
}

/**
 * Varredura. Recebe as keywords do tenant; devolve [{ kw, records }] para o
 * orquestrador rodar relevância por keyword e gravar.
 *
 * opts: { delay, config, runDate, stats }
 *   config.modalidades  → "6,8,9,4" (default MODALIDADES_DEFAULT)
 *   config.lookbackDays → janela p/ trás a partir de runDate (default 3, cobre atraso de publicação)
 */
async function sweep(keywords, opts = {}) {
  const delay = opts.delay || 250;
  const cfg = opts.config || {};
  const runDate = opts.runDate || new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const lookback = parseInt(cfg.lookbackDays || process.env.SWEEP_LOOKBACK_DAYS || '3', 10);
  const modalidades = (cfg.modalidades
    ? String(cfg.modalidades).split(',').map((x) => parseInt(x.trim(), 10)).filter(Boolean)
    : MODALIDADES_DEFAULT);

  const dataFinal = YYYYMMDD(runDate);
  const dataInicial = YYYYMMDD(daysBefore(runDate, lookback));

  // tokens distintivos das keywords (p/ pré-filtro citar princípio ativo no objeto)
  const keyTokens = [...new Set(keywords.flatMap((k) => termTokens(k.termo)).filter((t) => t.length >= 5))];

  const stats = opts.stats || {};
  stats.enumerados = 0; stats.preFiltrados = 0; stats.comItemCasado = 0; stats.enumErros = 0;
  const byKw = new Map(); // termo → { kw, records: [] }
  const seenCompra = new Set(); // evita reprocessar mesma contratação entre modalidades

  console.log(`[sweep] janela ${dataInicial}..${dataFinal} | modalidades ${modalidades.join(',')} | ${keywords.length} keyword(s)`);

  for (const modalidade of modalidades) {
    const lista = await enumerarModalidade({ modalidade, dataInicial, dataFinal, delay, stats });
    console.log(`[sweep] modalidade ${modalidade} (${MODALIDADE_NOME[modalidade] || '?'}) → ${lista.length} contratação(ões)`);

    for (const c of lista) {
      const ctrl = c.numeroControlePNCP || `${(c.orgaoEntidade || {}).cnpj}-${c.anoCompra}-${c.sequencialCompra}`;
      if (seenCompra.has(ctrl)) continue;
      seenCompra.add(ctrl);

      // (2) pré-filtro de medicamento — barato, antes de baixar itens
      if (!passaPreFiltro(c.objetoCompra, keyTokens)) continue;
      stats.preFiltrados++;

      const cnpj = (c.orgaoEntidade || {}).cnpj;
      const ano = c.anoCompra;
      const seq = c.sequencialCompra;
      if (!cnpj || !ano || !seq) continue;

      // (3) baixa itens e casa contra as keywords (full recall local)
      let pairs = [];
      try {
        pairs = await fetchCompraRecords({ cnpj, ano, seq, meta: metaFromListing(c), keywords, delay });
      } catch (e) {
        console.error(`[sweep] itens ${ctrl} falhou: ${e.message}`);
        continue;
      }
      if (pairs.length) stats.comItemCasado++;
      for (const { kw, record } of pairs) {
        const g = byKw.get(kw.termo) || { kw, records: [] };
        g.records.push(record);
        byKw.set(kw.termo, g);
      }
      await sleep(Math.round(delay / 2));
    }
  }

  const totalRecs = [...byKw.values()].reduce((a, g) => a + g.records.length, 0);
  console.log(`[sweep] cobertura — enumerados ~${stats.enumerados}, pós-medicamento ${stats.preFiltrados}, contratações com item casado ${stats.comItemCasado}, registros ${totalRecs}, erros-enum ${stats.enumErros}`);
  return [...byKw.values()];
}

module.exports = { name: 'PNCP-Sweep', key: 'pncp_sweep', implemented: true, sweep, MODALIDADE_NOME, MED_RE, passaPreFiltro };
