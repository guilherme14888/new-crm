// Núcleo compartilhado dos conectores PNCP.
// Reúne a parte PROVADA (já usada pelo conector de busca): dada uma contratação
// (cnpj/ano/sequencial), baixa os ITENS e os RESULTADOS e monta 1 registro por
// item × concorrente, no mesmo shape que o restante do pipeline espera.
//
// É consumido por:
//   • pncp-sweep.js → varredura completa (enumeração por data+modalidade)
//   • (futuro) pncp.js poderia migrar para cá; mantido intacto por ora p/ não
//     introduzir regressão no caminho de busca que já roda em produção.

const { getJson, sleep } = require('../http');
const { regiaoOf, numOrNull, mapStatus, toDateTime, matchesTerm } = require('../normalize');

const BASE = 'https://pncp.gov.br';

/** "Encerramento" textual a partir da situação/datas da contratação. */
function encerramentoFrom({ cancelado, temResultado, dataEncerramentoProposta }) {
  if (cancelado) return 'Cancelado';
  if (temResultado) return 'Encerrado com vencedor';
  const fim = dataEncerramentoProposta ? new Date(dataEncerramentoProposta).getTime() : null;
  if (fim && fim < Date.now()) return 'Fechado para receber propostas';
  return 'Recebendo propostas';
}

/**
 * Baixa itens+resultados de UMA contratação e devolve registros já classificados
 * pela 1ª palavra-chave que casar com a descrição do item (full recall local:
 * lemos TODOS os itens e decidimos nós mesmos — não dependemos do índice textual
 * do PNCP). Itens que não casam com nenhuma keyword são descartados (de graça).
 *
 * @param {object} p
 *   cnpj, ano, seq     → identificam a contratação (endpoint /orgaos/{cnpj}/compras/{ano}/{seq})
 *   meta               → dados de cabeçalho vindos da enumeração (órgão, uf, datas, modalidade…)
 *   keywords           → [{ termo, produtoCandidato, contexto, negativos }]
 *   delay              → throttle entre chamadas
 * @returns {Promise<Array<{ kw, record }>>}  registros agrupáveis por keyword
 */
async function fetchCompraRecords({ cnpj, ano, seq, meta = {}, keywords = [], delay = 250 }) {
  let itens = [];
  try {
    itens = await getJson(`${BASE}/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens`);
  } catch { return []; }
  if (!Array.isArray(itens) || itens.length === 0) return [];

  const controle = meta.numeroControlePNCP || `${cnpj}-${ano}-${seq}`;
  const status = mapStatus(meta.situacaoNome, meta.dataAberturaProposta, meta.temResultado);

  const base = {
    fonte: 'PNCP',
    pncpControle: controle,
    status,
    dataUltimaAtual: toDateTime(meta.dataAtualizacao || meta.dataPublicacaoPncp),
    regiao: regiaoOf(meta.uf),
    cnpj: meta.orgaoCnpj || cnpj,
    licitador: meta.orgaoNome || meta.unidadeNome || null,
    uf: meta.uf || null,
    municipio: meta.municipioNome || null,
    nEdital: meta.numeroCompra || null,
    nEditalOriginal: meta.numeroCompra || null,
    nProcesso: meta.numeroProcesso || controle,
    tipoContratacao: meta.tipoInstrumento || null,
    modalidade: meta.modalidadeNome || null,
    nomeSite: 'PNCP',
    urlSite: `${BASE}/app/editais/${cnpj}/${ano}/${seq}`,
    prazoEdital: toDateTime(meta.dataEncerramentoProposta),
    dataHoraCertame: toDateTime(meta.dataAberturaProposta || meta.dataPublicacaoPncp),
    etapaSessao: meta.situacaoNome || null,
    encerramento: encerramentoFrom(meta),
    processoKey: controle,
    externalKey: controle,
  };

  const out = [];
  for (const it of itens) {
    // Qual keyword casa com a descrição? (a 1ª; lista costuma ser disjunta)
    const kw = keywords.find((k) => matchesTerm(it.descricao, k.termo));
    if (!kw) continue;

    await sleep(Math.round(delay / 3));
    const meEpp = [1, 2, 3].includes(Number(it.tipoBeneficio)) ? 'Sim' : 'Não';
    const judText = `${meta.objetoCompra || ''} ${it.descricao || ''}`;
    const mandadoJudicial = /judicial|mandad|liminar|demanda\s+judicial/i.test(judText) ? 'Sim' : 'Não';

    const item = {
      ...base,
      termoBusca: kw.termo,
      produtoCandidato: kw.produtoCandidato ?? kw.produto_candidato ?? null,
      produto: kw.termo,
      etapaItem: it.situacaoCompraItemNome || null,
      lote: 1,
      item: numOrNull(it.numeroItem),
      produtoLicitado: it.descricao || null,
      quantidade: numOrNull(it.quantidade),
      unidadeOriginal: it.unidadeMedida || null,
      mandadoJudicial,
      meEpp,
      precoEstimadoUnit: numOrNull(it.valorUnitarioEstimado),
      precoEstimadoTotal: numOrNull(it.valorTotal),
    };

    let resultados = [];
    if (it.temResultado) {
      try {
        const r = await getJson(
          `${BASE}/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens/${it.numeroItem}/resultados`,
          { allowEmpty: true }
        );
        if (Array.isArray(r)) resultados = r;
      } catch { /* ignora */ }
    }

    if (resultados.length === 0) {
      out.push({ kw, record: { ...item, posicao: null, concorrente: null, cnpjConcorrente: null, ufConcorrente: null, precoFinalUnit: null, precoFinalTotal: null } });
    } else {
      for (const r of resultados) {
        out.push({ kw, record: {
          ...item,
          posicao: numOrNull(r.ordemClassificacaoSrp ?? r.classificacao ?? r.ordem),
          concorrente: r.nomeRazaoSocialFornecedor || r.nomeFornecedor || null,
          cnpjConcorrente: r.niFornecedor || r.cnpjCpfFornecedor || null,
          ufConcorrente: r.ufFornecedor || null,
          precoFinalUnit: numOrNull(r.valorUnitarioHomologado ?? r.valorUnitario),
          precoFinalTotal: numOrNull(r.valorTotalHomologado ?? r.valorTotal),
        } });
      }
    }
  }
  return out;
}

module.exports = { BASE, encerramentoFrom, fetchCompraRecords };
