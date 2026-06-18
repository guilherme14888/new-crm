// Configuração do provedor de IA por tenant (escolhido na UI) com fallback no .env.
// Usado pela classificação de relevância (ingest/relevance.js) e pela sugestão de
// contexto de palavras-chave (services/keywordContext.js).

const db = require('./../db');

// Provedores suportados: rótulo p/ a UI, modelo default e variável de ambiente de fallback.
const PROVIDERS = {
  anthropic: { label: 'Anthropic (Claude)',   defaultModel: 'claude-haiku-4-5-20251001', envKey: 'ANTHROPIC_API_KEY' },
  openai:    { label: 'OpenAI (GPT)',          defaultModel: 'gpt-4o-mini',               envKey: 'OPENAI_API_KEY'    },
  gemini:    { label: 'Google (Gemini)',       defaultModel: 'gemini-2.0-flash',          envKey: 'GEMINI_API_KEY'    },
  grok:      { label: 'xAI (Grok)',            defaultModel: 'grok-2-latest',             envKey: 'XAI_API_KEY'       },
  groq:      { label: 'Groq (Llama/Mixtral)',  defaultModel: 'llama-3.3-70b-versatile',   envKey: 'GROQ_API_KEY'      },
  deepseek:  { label: 'DeepSeek',              defaultModel: 'deepseek-chat',             envKey: 'DEEPSEEK_API_KEY'  },
};
const DEFAULT_PROVIDER = 'anthropic';

function defOf(provider) { return PROVIDERS[provider] || PROVIDERS[DEFAULT_PROVIDER]; }

async function readRow(companyId) {
  try {
    const [r] = await db.query('SELECT provider, api_key, model, updated_at FROM market_intelligence_ai WHERE company_id = ?', [companyId]);
    return r[0] || null;
  } catch { return null; }
}

/**
 * Config EFETIVA para uso (inclui a chave). Prioriza o que o tenant salvou; se não
 * houver chave salva, cai no .env do provedor escolhido (ou anthropic).
 * @returns {Promise<{provider, apiKey, model, source:'tenant'|'env'|'none'}>}
 */
async function loadAiConfig(companyId) {
  const row = await readRow(companyId);
  const provider = (row && row.provider) || DEFAULT_PROVIDER;
  const def = defOf(provider);
  const model = (row && row.model) || def.defaultModel;

  if (row && row.api_key) return { provider, apiKey: row.api_key, model, source: 'tenant' };

  const envKey = process.env[def.envKey];
  if (envKey) return { provider, apiKey: envKey, model, source: 'env' };

  return { provider, apiKey: null, model, source: 'none' };
}

/** Versão pública (para a UI) — NUNCA devolve a chave, só se existe. */
async function getAiConfigPublic(companyId) {
  const row = await readRow(companyId);
  const eff = await loadAiConfig(companyId);
  return {
    provider: (row && row.provider) || DEFAULT_PROVIDER,
    model: (row && row.model) || '',
    hasKey: !!(row && row.api_key),
    source: eff.source,             // tenant | env | none
    updatedAt: (row && row.updated_at) || null,
    providers: Object.entries(PROVIDERS).map(([key, v]) => ({ key, label: v.label, defaultModel: v.defaultModel })),
  };
}

/** Salva/atualiza a config do tenant. Se apiKey vier vazio, mantém a chave atual. */
async function saveAiConfig(companyId, { provider, apiKey, model }) {
  if (provider && !PROVIDERS[provider]) throw new Error(`Provedor inválido: ${provider}`);
  const row = await readRow(companyId);
  const finalProvider = provider || (row && row.provider) || DEFAULT_PROVIDER;
  // chave: usa a nova se informada; senão mantém a existente (não apaga ao trocar modelo)
  const finalKey = (apiKey !== undefined && apiKey !== null && String(apiKey).trim() !== '')
    ? String(apiKey).trim()
    : (row ? row.api_key : null);
  const finalModel = (model !== undefined) ? (String(model).trim() || null) : (row ? row.model : null);

  await db.query(
    `INSERT INTO market_intelligence_ai (company_id, provider, api_key, model)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE provider=VALUES(provider), api_key=VALUES(api_key), model=VALUES(model)`,
    [companyId, finalProvider, finalKey, finalModel]
  );
  return getAiConfigPublic(companyId);
}

module.exports = { PROVIDERS, DEFAULT_PROVIDER, loadAiConfig, getAiConfigPublic, saveAiConfig };
