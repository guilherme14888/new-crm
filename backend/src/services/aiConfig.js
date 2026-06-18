// Configuração do provedor de IA por tenant (escolhido na UI) com fallback no .env.
// Usado pela classificação de relevância (ingest/relevance.js) e pela sugestão de
// contexto de palavras-chave (services/keywordContext.js).

const db = require('./../db');
const crypto = require('crypto');

// IA é configurada de forma GLOBAL (uma vez), pela empresa Default/master, e usada
// por todos os tenants na captação de licitações. O menu só aparece para admins
// da empresa Default.
const MASTER_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

// ── Criptografia da chave em repouso (AES-256-GCM) ───────────────────────────
// A chave de API NÃO pode ser "hash" (precisamos do valor em claro p/ chamar o
// provedor). Então guardamos CIFRADA: ninguém lê a chave olhando o banco, e ela
// só é decifrada na hora de usar. O segredo vem do ambiente (estável no deploy).
const ENC_PREFIX = 'enc:v1:';
const ENC_KEY = crypto.createHash('sha256')
  .update(String(process.env.AI_KEY_SECRET || process.env.JWT_SECRET || 'crm-br4-ai-secret'))
  .digest(); // 32 bytes

function encryptSecret(plain) {
  if (plain == null || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

function decryptSecret(stored) {
  if (stored == null) return null;
  const s = String(stored);
  if (!s.startsWith(ENC_PREFIX)) return s; // legado em texto puro (ainda funciona)
  try {
    const raw = Buffer.from(s.slice(ENC_PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), ct = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch { return null; } // segredo mudou ou dado corrompido
}

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

// Config global → sempre lida/gravada sob a empresa master (o companyId recebido
// é ignorado de propósito: a IA é única para todo o sistema).
async function readRow() {
  try {
    const [r] = await db.query('SELECT provider, api_key, model, updated_at FROM market_intelligence_ai WHERE company_id = ?', [MASTER_COMPANY_ID]);
    return r[0] || null;
  } catch { return null; }
}

/**
 * Config EFETIVA para uso (inclui a chave). Prioriza o que o tenant salvou; se não
 * houver chave salva, cai no .env do provedor escolhido (ou anthropic).
 * @returns {Promise<{provider, apiKey, model, source:'tenant'|'env'|'none'}>}
 */
async function loadAiConfig(_companyId) {
  const row = await readRow();
  const provider = (row && row.provider) || DEFAULT_PROVIDER;
  const def = defOf(provider);
  const model = (row && row.model) || def.defaultModel;

  if (row && row.api_key) {
    const apiKey = decryptSecret(row.api_key);
    if (apiKey) return { provider, apiKey, model, source: 'tenant' };
  }

  const envKey = process.env[def.envKey];
  if (envKey) return { provider, apiKey: envKey, model, source: 'env' };

  return { provider, apiKey: null, model, source: 'none' };
}

/** Versão pública (para a UI) — NUNCA devolve a chave, só se existe. */
async function getAiConfigPublic(_companyId) {
  const row = await readRow();
  const eff = await loadAiConfig();
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
async function saveAiConfig(_companyId, { provider, apiKey, model }) {
  if (provider && !PROVIDERS[provider]) throw new Error(`Provedor inválido: ${provider}`);
  const row = await readRow();
  const finalProvider = provider || (row && row.provider) || DEFAULT_PROVIDER;
  const providerChanged = !!(provider && row && row.provider && provider !== row.provider);
  // chave: nova → cifra; sem nova mas trocou de provedor → LIMPA (não usa chave de
  // outro provedor); senão mantém a existente (já cifrada). Evita o mismatch que
  // gerava HTTP 502 (ex.: provedor Groq com chave xAI).
  let finalKey;
  if (apiKey !== undefined && apiKey !== null && String(apiKey).trim() !== '') {
    finalKey = encryptSecret(String(apiKey).trim());
  } else if (providerChanged) {
    finalKey = null;
  } else {
    finalKey = row ? row.api_key : null;
  }
  const finalModel = (model !== undefined) ? (String(model).trim() || null) : (row ? row.model : null);

  await db.query(
    `INSERT INTO market_intelligence_ai (company_id, provider, api_key, model)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE provider=VALUES(provider), api_key=VALUES(api_key), model=VALUES(model)`,
    [MASTER_COMPANY_ID, finalProvider, finalKey, finalModel]
  );
  return getAiConfigPublic();
}

module.exports = { PROVIDERS, DEFAULT_PROVIDER, loadAiConfig, getAiConfigPublic, saveAiConfig };
