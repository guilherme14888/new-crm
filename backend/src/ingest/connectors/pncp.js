// Conector PNCP — Portal Nacional de Contratações Públicas (fonte oficial).
// Interface comum: { name, enabled, search(keyword, opts) → Promise<record[]> }

const { getJson, sleep } = require('../http');
const { regiaoOf, numOrNull, mapStatus, toDateTime, matchesTerm } = require('../normalize');

const BASE = 'https://pncp.gov.br';

// "Encerramento" no sentido do status do processo (espelha a coluna da base manual)
function encerramentoOf(hit) {
  if (hit.cancelado) return 'Cancelado';
  if (hit.tem_resultado) return 'Encerrado com vencedor';
  const fim = hit.data_fim_vigencia ? new Date(hit.data_fim_vigencia).getTime() : null;
  if (fim && fim < Date.now()) return 'Fechado para receber propostas';
  return 'Recebendo propostas';
}

/** Busca editais no PNCP por palavra-chave (paginado) e retorna registros normalizados. */
async function search(keyword, opts = {}) {
  const { pages = 5, size = 50, delay = 300 } = opts;
  const termo = keyword.termo;
  const produtoCandidato = keyword.produtoCandidato ?? keyword.produto_candidato ?? null;
  const out = [];

  let page = 1;
  while (page <= pages) {
    const url = `${BASE}/api/search/?q=${encodeURIComponent(termo)}` +
      `&tipos_documento=edital&ordenacao=-data&pagina=${page}&tam_pagina=${size}&status=todos`;
    const data = await getJson(url);
    const items = (data && data.items) || [];
    if (items.length === 0) break;

    for (const hit of items) {
      await sleep(delay);
      const recs = await compraToRecords(hit, termo, produtoCandidato, delay);
      out.push(...recs);
    }
    if (page * size >= ((data && data.total) || 0)) break;
    page++;
  }
  return out;
}

/** Para um hit da busca: baixa itens + resultados e gera 1 registro por item/concorrente. */
async function compraToRecords(hit, termo, produtoCandidato, delay) {
  const m = String(hit.item_url || '').match(/\/compras\/(\d+)\/(\d+)\/(\d+)/);
  if (!m) return [];
  const [, cnpj, ano, seq] = m;
  const controle = hit.numero_controle_pncp || `${cnpj}-${ano}-${seq}`;
  const dataIni = hit.data_inicio_vigencia;
  const status = mapStatus(hit.situacao_nome, dataIni, hit.tem_resultado);

  let itens = [];
  try {
    itens = await getJson(`${BASE}/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens`);
  } catch { return []; }
  if (!Array.isArray(itens) || itens.length === 0) return [];

  // nº do edital: campo `numero` ou extraído do título ("... nº 50/2026")
  const tituloNum = (hit.title || '').match(/n[ºo]\s*([\d./-]+)/i);
  const nEdital = hit.numero || (tituloNum ? tituloNum[1] : null);

  const base = {
    fonte: 'PNCP',
    pncpControle: controle,
    termoBusca: termo,
    status,
    dataUltimaAtual: toDateTime(hit.data_atualizacao_pncp || hit.data_publicacao_pncp),
    regiao: regiaoOf(hit.uf),
    cnpj: hit.orgao_cnpj || cnpj,
    licitador: hit.orgao_nome || hit.unidade_nome || null,
    uf: hit.uf || null,
    municipio: hit.municipio_nome || null,
    nEdital,
    nEditalOriginal: nEdital,
    nProcesso: controle,
    tipoContratacao: hit.tipo_nome || null,          // ex.: "Edital", "Aviso de Contratação Direta"
    modalidade: hit.modalidade_licitacao_nome || null,
    nomeSite: 'PNCP',
    urlSite: `${BASE}/app/editais/${cnpj}/${ano}/${seq}`,
    prazoEdital: toDateTime(hit.data_fim_vigencia),
    dataHoraCertame: toDateTime(dataIni || hit.data_publicacao_pncp),
    produtoCandidato,
    produto: termo,
    etapaSessao: hit.situacao_nome || null,
    encerramento: encerramentoOf(hit),
    processoKey: controle,
    externalKey: controle,
  };

  const records = [];
  for (const it of itens) {
    // Scraping OBJETIVO: dentro do edital, mantém só os itens cuja descrição casa
    // com a palavra-chave buscada (descarta os demais itens — a "sujeira").
    if (!matchesTerm(it.descricao, termo)) continue;
    await sleep(Math.round(delay / 3));
    // ME/EPP: tipoBeneficio 1/2/3 = exclusiva/cota/subcontratação; 4 = sem benefício
    const meEpp = [1, 2, 3].includes(Number(it.tipoBeneficio)) ? 'Sim' : 'Não';
    // mandado judicial: PNCP não tem campo próprio → heurística pelo texto
    const judText = `${hit.title || ''} ${it.descricao || ''}`;
    const mandadoJudicial = /judicial|mandad|liminar|demanda\s+judicial/i.test(judText) ? 'Sim' : 'Não';
    const item = {
      ...base,
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
      records.push({ ...item, posicao: null, concorrente: null, cnpjConcorrente: null, ufConcorrente: null, precoFinalUnit: null, precoFinalTotal: null });
    } else {
      for (const r of resultados) {
        records.push({
          ...item,
          posicao: numOrNull(r.ordemClassificacaoSrp ?? r.classificacao ?? r.ordem),
          concorrente: r.nomeRazaoSocialFornecedor || r.nomeFornecedor || null,
          cnpjConcorrente: r.niFornecedor || r.cnpjCpfFornecedor || null,
          ufConcorrente: r.ufFornecedor || null,
          precoFinalUnit: numOrNull(r.valorUnitarioHomologado ?? r.valorUnitario),
          precoFinalTotal: numOrNull(r.valorTotalHomologado ?? r.valorTotal),
        });
      }
    }
  }
  return records;
}

module.exports = { name: 'PNCP', key: 'pncp', implemented: true, search };
