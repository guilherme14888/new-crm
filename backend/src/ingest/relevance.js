// Filtro de relevância por contexto do negócio — em CAMADAS, para minimizar custo:
//
//   T0  Negativos    (grátis, determinístico)  — termos que excluem o achado.
//   T1  Cache exato  (grátis após 1ª vez)       — veredito por (empresa,termo,desc).
//   T2  Cache semântico (1 embedding, sem LLM)  — item parecido reaproveita veredito
//                                                  (VECTOR nativo do MariaDB, cosine).
//   T3  LLM em lote  (Haiku + prompt caching)   — só o que sobrou; veredito é cacheado.
//
// Liga a IA com: INGEST_AI_RELEVANCE=true + ANTHROPIC_API_KEY.
// O cache semântico (T2) liga sozinho se houver provedor de embeddings (Voyage/OpenAI).

const crypto = require('crypto');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { embed, EMBED_ON, toVecText } = require('./embeddings');

const AI_ON = String(process.env.INGEST_AI_RELEVANCE || 'false').toLowerCase() === 'true'
  && !!process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.INGEST_AI_MODEL || 'claude-haiku-4-5-20251001';
const BATCH_SIZE = parseInt(process.env.INGEST_AI_BATCH || '25', 10);
// distância cosine máxima para reaproveitar veredito semântico (0 = idêntico)
const SEM_THRESHOLD = parseFloat(process.env.INGEST_SEM_THRESHOLD || '0.12');

// ── T0 Negativos ──────────────────────────────────────────────────────────────
const norm = (s) => String(s == null ? '' : s).toLowerCase();
function parseNegatives(str) {
  if (!str) return [];
  return String(str).split(/[,;\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
}
function passesNegatives(text, negatives) {
  if (!negatives || !negatives.length) return true;
  const t = norm(text);
  return !negatives.some((n) => t.includes(n));
}

// descrição normalizada e chave de cache
const descOf = (rec) => `${rec.produtoLicitado || ''} ${rec.produto || ''}`.trim();
function normDesc(s) {
  return norm(s).replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 240);
}
function hashKey(companyId, termo, desc) {
  return crypto.createHash('sha256').update(`${companyId}|${norm(termo)}|${normDesc(desc)}`).digest('hex');
}

// ── T1 Cache exato ──────────────────────────────────────────────────────────────
async function cacheGetMany(keys) {
  if (!keys.length) return new Map();
  const [rows] = await db.query(
    `SELECT cache_key, verdict FROM market_intelligence_relevance_cache WHERE cache_key IN (${keys.map(() => '?').join(',')})`,
    keys
  );
  return new Map(rows.map((r) => [r.cache_key, !!r.verdict]));
}
async function cacheSetMany(entries) {
  if (!entries.length) return;
  const values = entries.map(() => '(?,?,?,?,?)').join(',');
  const params = entries.flatMap((e) => [e.key, e.companyId, e.termo, e.verdict ? 1 : 0, MODEL]);
  await db.query(
    `INSERT IGNORE INTO market_intelligence_relevance_cache (cache_key, company_id, termo, verdict, model) VALUES ${values}`,
    params
  );
}

// ── T2 Cache semântico (vetorial) ────────────────────────────────────────────────
async function vecLookup(companyId, termo, vecText) {
  const [rows] = await db.query(
    `SELECT verdict, VEC_DISTANCE_COSINE(embedding, VEC_FromText(?)) d
       FROM market_intelligence_relevance_vec
      WHERE company_id = ? AND termo = ?
      ORDER BY d LIMIT 1`,
    [vecText, companyId, norm(termo)]
  );
  if (rows.length && rows[0].d <= SEM_THRESHOLD) return !!rows[0].verdict;
  return null;
}
async function vecInsert(companyId, termo, desc, verdict, vecText) {
  await db.query(
    `INSERT INTO market_intelligence_relevance_vec (id, company_id, termo, descricao, verdict, embedding)
     VALUES (?,?,?,?,?, VEC_FromText(?))`,
    [uuidv4(), companyId, norm(termo), desc.slice(0, 500), verdict ? 1 : 0, vecText]
  );
}

// ── T3 LLM em lote (prompt caching no bloco de regras) ────────────────────────────
const SYSTEM_RULES =
  'Você classifica itens de licitação pública pela aderência ao CONTEXTO de um negócio.\n' +
  'Regras:\n' +
  '1) Considere sinônimos, abreviações e variações de grafia (ex.: "pneu" = "pneumático").\n' +
  '2) Um item só é relevante se for do MESMO produto/categoria do contexto. Rejeite itens de ' +
  'categoria diferente que apenas compartilham uma palavra (ex.: "pneu para carrinho de mão/obra" ' +
  'NÃO é "pneu automotivo"; "papel higiênico" NÃO é "papel sulfite").\n' +
  '3) Na dúvida real, rejeite.\n' +
  'Responda SOMENTE um JSON array, um objeto por item, no formato ' +
  '[{"i":0,"r":true},{"i":1,"r":false}] — sem nenhum texto fora do JSON.';

async function classifyBatchLLM(items, keyword) {
  const lista = items.map((it, i) => `${i}) ${normDesc(descOf(it)).slice(0, 200)}`).join('\n');
  const userMsg =
    `CONTEXTO DO NEGÓCIO: ${keyword.contexto || '(não informado)'}\n` +
    `TERMO BUSCADO: ${keyword.termo}\n` +
    `ITENS:\n${lista}\n\n` +
    `Classifique cada item (r=true se pertence ao contexto do negócio).`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: Math.min(20 + items.length * 12, 1024),
      // bloco de regras é constante → cache_control reaproveita os tokens de entrada
      system: [{ type: 'text', text: SYSTEM_RULES, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  const txt = (data?.content?.[0]?.text || '').trim();
  const m = txt.match(/\[[\s\S]*\]/);
  const verdicts = new Array(items.length).fill(true); // default permissivo em erro de parse
  if (m) {
    try {
      for (const o of JSON.parse(m[0])) if (typeof o.i === 'number') verdicts[o.i] = !!o.r;
    } catch { /* mantém default */ }
  }
  return verdicts;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ── Pipeline principal: filtra um conjunto de registros de UMA keyword ────────────
async function filterRelevant(records, keyword, companyId, stats = {}) {
  const negatives = parseNegatives(keyword.negativos);
  // T0
  let survivors = records.filter((r) => passesNegatives(descOf(r), negatives));
  stats.skippedNeg = (stats.skippedNeg || 0) + (records.length - survivors.length);
  if (!AI_ON || !survivors.length) { stats.kept = (stats.kept || 0) + survivors.length; return survivors; }

  // T1 cache exato
  const keys = survivors.map((r) => hashKey(companyId, keyword.termo, descOf(r)));
  const cached = await cacheGetMany([...new Set(keys)]);
  const decided = new Map(); // index → verdict
  const undecided = [];
  survivors.forEach((r, i) => {
    const v = cached.get(keys[i]);
    if (v === undefined) undecided.push(i); else decided.set(i, v);
  });
  stats.cacheHits = (stats.cacheHits || 0) + (survivors.length - undecided.length);

  // T2 cache semântico (embeddings) para os indecisos
  const toPersist = [];        // {key, companyId, termo, verdict}
  const toPersistVec = [];     // {desc, verdict, vecText}
  let stillUndecided = undecided;
  if (EMBED_ON && undecided.length) {
    const texts = undecided.map((i) => normDesc(descOf(survivors[i])));
    const vectors = await embed(texts);
    if (vectors) {
      stats.embedCalls = (stats.embedCalls || 0) + 1;
      const remaining = [];
      for (let k = 0; k < undecided.length; k++) {
        const i = undecided[k];
        const vecText = toVecText(vectors[k]);
        survivors[i].__vecText = vecText; // guarda p/ persistir depois se for ao LLM
        const v = await vecLookup(companyId, keyword.termo, vecText);
        if (v === null) { remaining.push(i); }
        else {
          decided.set(i, v);
          toPersist.push({ key: keys[i], companyId, termo: keyword.termo, verdict: v });
        }
      }
      stats.semanticHits = (stats.semanticHits || 0) + (undecided.length - remaining.length);
      stillUndecided = remaining;
    }
  }

  // T3 LLM em lote
  for (const group of chunk(stillUndecided, BATCH_SIZE)) {
    const items = group.map((i) => survivors[i]);
    let verdicts;
    try { verdicts = await classifyBatchLLM(items, keyword); stats.aiCalls = (stats.aiCalls || 0) + 1; }
    catch (e) { verdicts = items.map(() => true); stats.aiErrors = (stats.aiErrors || 0) + 1; }
    group.forEach((i, k) => {
      const v = verdicts[k];
      decided.set(i, v);
      toPersist.push({ key: keys[i], companyId, termo: keyword.termo, verdict: v });
      if (EMBED_ON && survivors[i].__vecText) toPersistVec.push({ desc: descOf(survivors[i]), verdict: v, vecText: survivors[i].__vecText });
    });
  }

  // persiste vereditos
  await cacheSetMany(toPersist);
  for (const v of toPersistVec) { try { await vecInsert(companyId, keyword.termo, v.desc, v.verdict, v.vecText); } catch {} }

  const relevant = survivors.filter((_, i) => decided.get(i) !== false);
  stats.skippedAI = (stats.skippedAI || 0) + (survivors.length - relevant.length);
  stats.kept = (stats.kept || 0) + relevant.length;
  // limpa campo temporário
  for (const r of relevant) delete r.__vecText;
  return relevant;
}

// Compatibilidade: avaliação unitária (usa só T0; T1-T3 ficam no filterRelevant em lote)
async function isRelevant(record, keyword) {
  return passesNegatives(descOf(record), parseNegatives(keyword.negativos));
}

module.exports = { parseNegatives, passesNegatives, filterRelevant, isRelevant, AI_ON, EMBED_ON };
