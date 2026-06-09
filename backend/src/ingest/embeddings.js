// Provedor de embeddings (opcional) para o cache semântico.
// Ativa quando há chave configurada. Anthropic não gera embeddings, então usamos
// Voyage (recomendado pela Anthropic) ou OpenAI. Ambos produzem 1024 dimensões.
//
// .env:
//   EMBEDDINGS_PROVIDER = voyage | openai           (default: voyage se houver key)
//   VOYAGE_API_KEY=...   VOYAGE_MODEL=voyage-3.5-lite
//   OPENAI_API_KEY=...   OPENAI_EMBED_MODEL=text-embedding-3-small

const EMBED_DIM = 1024;
const PROVIDER = (process.env.EMBEDDINGS_PROVIDER
  || (process.env.VOYAGE_API_KEY ? 'voyage' : (process.env.OPENAI_API_KEY ? 'openai' : null)));
const EMBED_ON = PROVIDER === 'voyage' ? !!process.env.VOYAGE_API_KEY
  : PROVIDER === 'openai' ? !!process.env.OPENAI_API_KEY : false;

/** Gera embeddings via Voyage AI (recomendado pela Anthropic). */
async function embedVoyage(texts) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({
      model: process.env.VOYAGE_MODEL || 'voyage-3.5-lite',
      input: texts,
      output_dimension: EMBED_DIM,
      input_type: 'document',
    }),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}`);
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

/** Gera embeddings via OpenAI (dimensão reduzida para 1024 via `dimensions`). */
async function embedOpenAI(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
      input: texts,
      dimensions: EMBED_DIM,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

/** Retorna array de vetores (number[][]) ou null se desligado/erro. */
async function embed(texts) {
  if (!EMBED_ON || !texts.length) return null;
  try {
    return PROVIDER === 'openai' ? await embedOpenAI(texts) : await embedVoyage(texts);
  } catch (e) {
    console.error('[embeddings] falha:', e.message);
    return null;
  }
}

// MariaDB aceita o vetor como texto JSON via VEC_FromText('[...]')
const toVecText = (arr) => `[${arr.join(',')}]`;

module.exports = { embed, EMBED_ON, EMBED_DIM, PROVIDER, toVecText };
