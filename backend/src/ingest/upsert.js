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

let histSeq = 0;
// Comparações nulo-seguras p/ detectar transição relevante.
const sEq = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();
const nEq = (a, b) => (a == null ? null : Number(a)) === (b == null ? null : Number(b));
/** Houve mudança digna de histórico (status/situação/posição/vencedor/preço)? */
function hasTransition(prev, row) {
  return !(
    sEq(prev.status, row.status) &&
    sEq(prev.encerramento, row.encerramento) &&
    sEq(prev.concorrente, row.concorrente) &&
    nEq(prev.posicao, row.posicao) &&
    nEq(prev.preco_final_unit, row.preco_final_unit)
  );
}
/** Grava um snapshot do estado ATUAL no histórico (best-effort, nunca quebra a ingestão). */
async function recordHistory(miId, companyId, key, row, runDate) {
  try {
    histSeq++;
    await db.query(
      `INSERT INTO market_intelligence_history
         (id, company_id, mi_id, dedupe_key, status, encerramento, etapa_sessao, posicao,
          concorrente, cnpj_concorrente, preco_final_unit, preco_final_total, snapshot_at, run_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        `h-${Date.now().toString(36)}-${histSeq}`, companyId, miId, key,
        row.status ?? null, row.encerramento ?? null, row.etapa_sessao ?? null, row.posicao ?? null,
        row.concorrente ?? null, row.cnpj_concorrente ?? null, row.preco_final_unit ?? null, row.preco_final_total ?? null,
        toDateTime(new Date().toISOString()), runDate ?? null,
      ]
    );
  } catch { /* histórico é complementar; não bloqueia a gravação principal */ }
}

/** Monta o objeto-linha (snake_case) + a dedupe_key a partir do rec normalizado. */
function buildRow(rec) {
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
  return { row, key };
}

// Expressão de UPDATE compartilhada (acumula a origem sem duplicar: PNCP,EFFECTI,...).
const UPDATE_SET = (() => {
  const updates = UPDATABLE.map((c) => `${c}=VALUES(${c})`);
  updates.push("fontes = IF(FIND_IN_SET(VALUES(fonte), fontes) > 0, fontes, CONCAT_WS(',', fontes, VALUES(fonte)))");
  return updates.join(', ');
})();

/** rec = objeto normalizado (camelCase). Retorna 'inserted' | 'updated'. */
async function upsertRecord(rec) {
  // Blindagem multi-tenant: nunca grava sem company_id (evita linhas órfãs/sem dono).
  if (!rec.companyId) throw new Error('upsertRecord: company_id ausente — gravação bloqueada');
  const { row, key } = buildRow(rec);
  // estado anterior (mesma chave UNIQUE company_id+dedupe_key) para o histórico
  const [prevRows] = await db.query(
    `SELECT id, status, encerramento, posicao, concorrente, preco_final_unit
       FROM market_intelligence WHERE company_id = ? AND dedupe_key = ? LIMIT 1`,
    [rec.companyId, key]
  );
  const prev = prevRows[0] || null;

  const placeholders = COLS.map(() => '?').join(',');
  const vals = COLS.map((c) => (row[c] === undefined ? null : row[c]));
  const [res] = await db.query(
    `INSERT INTO market_intelligence (${COLS.join(',')}) VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${UPDATE_SET}`,
    vals
  );
  const action = res.affectedRows === 1 ? 'inserted' : 'updated';
  const miId = prev ? prev.id : row.id;
  if (!prev || hasTransition(prev, row)) {
    await recordHistory(miId, rec.companyId, key, row, rec.firstSeenDate);
  }
  return action;
}

// Insere um lote de snapshots de histórico de uma vez (best-effort, em chunks).
async function recordHistoryBatch(items) {
  if (!items.length) return;
  const CH = 200;
  for (let i = 0; i < items.length; i += CH) {
    const chunk = items.slice(i, i + CH);
    const ph = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
    const vals = [];
    const snap = toDateTime(new Date().toISOString());
    for (const it of chunk) {
      histSeq++;
      const r = it.row;
      vals.push(
        `h-${Date.now().toString(36)}-${histSeq}`, it.companyId, it.miId, it.key,
        r.status ?? null, r.encerramento ?? null, r.etapa_sessao ?? null, r.posicao ?? null,
        r.concorrente ?? null, r.cnpj_concorrente ?? null, r.preco_final_unit ?? null, r.preco_final_total ?? null,
        snap, it.runDate ?? null
      );
    }
    try {
      await db.query(
        `INSERT INTO market_intelligence_history
           (id, company_id, mi_id, dedupe_key, status, encerramento, etapa_sessao, posicao,
            concorrente, cnpj_concorrente, preco_final_unit, preco_final_total, snapshot_at, run_date)
         VALUES ${ph}`,
        vals
      );
    } catch { /* histórico é complementar; não bloqueia a gravação principal */ }
  }
}

/**
 * Grava um LOTE de registros de uma vez (bulk upsert), eliminando o N+1:
 * carrega o estado anterior em lote (para o histórico) e faz multi-row
 * INSERT ... ON DUPLICATE KEY UPDATE em chunks. Retorna {inserted, updated, errors}.
 * Idempotente — mesma semântica do upsertRecord, mas com poucas idas ao banco.
 */
async function upsertRecords(recs) {
  const out = { inserted: 0, updated: 0, errors: 0 };
  const valid = recs.filter((r) => r && r.companyId);
  out.errors += recs.length - valid.length;
  if (!valid.length) return out;

  // agrupa por empresa (normalmente uma só por chamada)
  const byCompany = new Map();
  for (const r of valid) {
    if (!byCompany.has(r.companyId)) byCompany.set(r.companyId, []);
    byCompany.get(r.companyId).push(r);
  }

  for (const [companyId, list] of byCompany) {
    // dedup intra-lote por chave (última ocorrência vence — espelha o upsert serial)
    const built = list.map(buildRow);
    const seen = new Set();
    const deduped = [];
    for (let i = built.length - 1; i >= 0; i--) {
      if (seen.has(built[i].key)) continue;
      seen.add(built[i].key);
      deduped.unshift({ ...built[i], runDate: list[i].firstSeenDate });
    }

    // estado anterior em lote (para detectar insert × update e transições)
    const keys = [...seen];
    const prevMap = new Map();
    for (let i = 0; i < keys.length; i += 500) {
      const chunk = keys.slice(i, i + 500);
      const [prevRows] = await db.query(
        `SELECT id, dedupe_key, status, encerramento, posicao, concorrente, preco_final_unit
           FROM market_intelligence
          WHERE company_id = ? AND dedupe_key IN (${chunk.map(() => '?').join(',')})`,
        [companyId, ...chunk]
      );
      for (const p of prevRows) prevMap.set(p.dedupe_key, p);
    }

    // bulk INSERT ... ON DUPLICATE KEY UPDATE em chunks
    const CH = 200;
    for (let i = 0; i < deduped.length; i += CH) {
      const chunk = deduped.slice(i, i + CH);
      const ph = chunk.map(() => `(${COLS.map(() => '?').join(',')})`).join(',');
      const vals = [];
      for (const { row } of chunk) for (const c of COLS) vals.push(row[c] === undefined ? null : row[c]);
      try {
        await db.query(
          `INSERT INTO market_intelligence (${COLS.join(',')}) VALUES ${ph}
           ON DUPLICATE KEY UPDATE ${UPDATE_SET}`,
          vals
        );
      } catch (e) {
        // fallback: tenta um a um para não perder o lote inteiro por causa de 1 registro
        for (const { row } of chunk) {
          try {
            const v = COLS.map((c) => (row[c] === undefined ? null : row[c]));
            await db.query(
              `INSERT INTO market_intelligence (${COLS.join(',')}) VALUES (${COLS.map(() => '?').join(',')})
               ON DUPLICATE KEY UPDATE ${UPDATE_SET}`, v
            );
          } catch { out.errors++; }
        }
      }
    }

    // contagem insert×update + histórico (em lote)
    const hist = [];
    for (const { row, key, runDate } of deduped) {
      const prev = prevMap.get(key) || null;
      if (prev) out.updated++; else out.inserted++;
      const miId = prev ? prev.id : row.id;
      if (!prev || hasTransition(prev, row)) hist.push({ miId, companyId, key, row, runDate });
    }
    await recordHistoryBatch(hist);
  }

  return out;
}

module.exports = { upsertRecord, upsertRecords };
