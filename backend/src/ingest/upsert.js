// Grava um registro normalizado em market_intelligence de forma idempotente e
// SEM duplicidade entre portais: conflito por dedupe_key (UNIQUE) faz UPDATE e
// acumula a origem em `fontes`.

const db = require('../db');
const { dedupeKey, toDateTime } = require('./normalize');

const COLS = [
  'id', 'company_id', 'fonte', 'fontes', 'pncp_controle', 'termo_busca', 'external_key', 'dedupe_key', 'ingested_at', 'first_seen_date',
  'status', 'etapa_item', 'data_ultima_atual', 'regiao', 'cnpj', 'licitador', 'uf', 'municipio',
  'n_edital', 'n_edital_original', 'n_processo', 'tipo_contratacao', 'modalidade', 'nome_site', 'url_site', 'prazo_edital', 'data_hora_certame',
  'lote', 'item', 'produto_candidato', 'produto', 'produto_licitado', 'quantidade', 'unidade_original',
  'mandado_judicial', 'me_epp',
  'preco_estimado_unit', 'preco_estimado_total', 'posicao', 'concorrente', 'cnpj_concorrente', 'uf_concorrente',
  'preco_final_unit', 'preco_final_total', 'etapa_sessao', 'encerramento', 'processo_key',
];

// campos atualizados em caso de conflito (não mexe em id/dedupe_key/external_key)
const NEVER_UPDATE = new Set(['id', 'company_id', 'dedupe_key', 'external_key', 'fonte', 'fontes', 'first_seen_date']);
const UPDATABLE = COLS.filter((c) => !NEVER_UPDATE.has(c));

// camelCase do registro normalizado → coluna snake_case
const FIELD = {
  fonte: 'fonte', pncpControle: 'pncp_controle', termoBusca: 'termo_busca', externalKey: 'external_key',
  status: 'status', etapaItem: 'etapa_item', dataUltimaAtual: 'data_ultima_atual', regiao: 'regiao',
  cnpj: 'cnpj', licitador: 'licitador', uf: 'uf', municipio: 'municipio', nEdital: 'n_edital',
  nEditalOriginal: 'n_edital_original', nProcesso: 'n_processo', tipoContratacao: 'tipo_contratacao',
  modalidade: 'modalidade', nomeSite: 'nome_site', urlSite: 'url_site',
  prazoEdital: 'prazo_edital', dataHoraCertame: 'data_hora_certame', lote: 'lote', item: 'item',
  produtoCandidato: 'produto_candidato', produto: 'produto', produtoLicitado: 'produto_licitado',
  quantidade: 'quantidade', unidadeOriginal: 'unidade_original',
  mandadoJudicial: 'mandado_judicial', meEpp: 'me_epp',
  precoEstimadoUnit: 'preco_estimado_unit',
  precoEstimadoTotal: 'preco_estimado_total', posicao: 'posicao', concorrente: 'concorrente',
  cnpjConcorrente: 'cnpj_concorrente', ufConcorrente: 'uf_concorrente', precoFinalUnit: 'preco_final_unit',
  precoFinalTotal: 'preco_final_total', etapaSessao: 'etapa_sessao', encerramento: 'encerramento', processoKey: 'processo_key',
};

let seq = 0;
/** Gera um id legível por execução (ex.: "pncp-lz4k-12"). */
function newId(fonte) {
  seq++;
  return `${(fonte || 'mi').toLowerCase()}-${Date.now().toString(36)}-${seq}`;
}

/** rec = objeto normalizado (camelCase). Retorna 'inserted' | 'updated'. */
async function upsertRecord(rec) {
  // Blindagem multi-tenant: nunca grava sem company_id (evita linhas órfãs/sem dono).
  if (!rec.companyId) throw new Error('upsertRecord: company_id ausente — gravação bloqueada');
  const key = dedupeKey(rec);
  const row = {
    id: newId(rec.fonte),
    company_id: rec.companyId || null,
    fonte: rec.fonte || 'MANUAL',
    fontes: rec.fonte || 'MANUAL',
    dedupe_key: key,
    ingested_at: toDateTime(new Date().toISOString()),
    first_seen_date: rec.firstSeenDate || null,   // dia da 1ª captura (insert-only)
  };
  for (const [camel, col] of Object.entries(FIELD)) {
    if (rec[camel] !== undefined) row[col] = rec[camel];
  }

  const updates = UPDATABLE.map((c) => `${c}=VALUES(${c})`);
  // acumula a origem sem duplicar (PNCP,EFFECTI,...)
  updates.push("fontes = IF(FIND_IN_SET(VALUES(fonte), fontes) > 0, fontes, CONCAT_WS(',', fontes, VALUES(fonte)))");

  const placeholders = COLS.map(() => '?').join(',');
  const vals = COLS.map((c) => (row[c] === undefined ? null : row[c]));
  const [res] = await db.query(
    `INSERT INTO market_intelligence (${COLS.join(',')}) VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
    vals
  );
  // affectedRows: 1 = insert, 2 = update (MySQL/MariaDB)
  return res.affectedRows === 1 ? 'inserted' : 'updated';
}

module.exports = { upsertRecord };
