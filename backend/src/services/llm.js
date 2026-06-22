// Cliente LLM agnóstico de provedor. Uma única função chat() que fala com
// Anthropic (Claude), OpenAI (GPT), Google (Gemini), xAI (Grok) e DeepSeek.
// Recebe sistema + mensagem do usuário e devolve o texto da resposta.
//
// OpenAI, Grok e DeepSeek compartilham o mesmo formato (Chat Completions),
// mudando só a base URL. Anthropic e Gemini têm formato próprio.

// Bases compatíveis com a API da OpenAI (mesmo corpo/headers).
const OPENAI_COMPAT_BASE = {
  openai:   'https://api.openai.com/v1',
  grok:     'https://api.x.ai/v1',          // xAI (Grok)
  groq:     'https://api.groq.com/openai/v1', // Groq (Llama/Mixtral) — inferência rápida
  deepseek: 'https://api.deepseek.com/v1',
};

// Timeout curto o bastante para o app devolver o erro REAL (chave inválida /
// provedor fora do ar) antes do proxy/Traefik cortar com um 502 de gateway.
const TIMEOUT_MS = 15000;

// Erro de timeout legível (o AbortError cru vira "The operation was aborted").
function abortError(timeoutMs) {
  const e = new Error(`Tempo esgotado (${Math.round(timeoutMs / 1000)}s) ao contatar o provedor de IA — verifique a chave e a conectividade do servidor com a internet.`);
  e.code = 'AI_TIMEOUT';
  return e;
}

async function getJson(url, headers = {}, timeoutMs = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = JSON.parse(text); msg = (j.error && (j.error.message || j.error)) || j.message || msg; } catch {}
      throw new Error(String(msg).slice(0, 300));
    }
    return text ? JSON.parse(text) : {};
  } catch (e) {
    if (e && e.name === 'AbortError') throw abortError(timeoutMs);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function postJson(url, headers, body, timeoutMs = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      // tenta extrair mensagem de erro do provedor
      let msg = `HTTP ${res.status}`;
      try { const j = JSON.parse(text); msg = (j.error && (j.error.message || j.error)) || j.message || msg; } catch {}
      throw new Error(String(msg).slice(0, 300));
    }
    return text ? JSON.parse(text) : {};
  } catch (e) {
    if (e && e.name === 'AbortError') throw abortError(timeoutMs);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// ── Anthropic (Claude) ────────────────────────────────────────────────────────
async function anthropic({ apiKey, model, system, user, maxTokens, timeoutMs }) {
  const data = await postJson('https://api.anthropic.com/v1/messages', {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }, {
    model,
    max_tokens: maxTokens,
    // bloco de regras constante → cache_control reaproveita tokens de entrada
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  }, timeoutMs);
  return (data && data.content && data.content[0] && data.content[0].text) || '';
}

// ── OpenAI / Grok / DeepSeek (formato Chat Completions) ───────────────────────
async function openaiCompat(provider, { apiKey, model, system, user, maxTokens, timeoutMs }) {
  const base = OPENAI_COMPAT_BASE[provider];
  const data = await postJson(`${base}/chat/completions`, {
    Authorization: `Bearer ${apiKey}`,
  }, {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }, timeoutMs);
  return (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

// ── Google (Gemini) ───────────────────────────────────────────────────────────
async function gemini({ apiKey, model, system, user, maxTokens, timeoutMs }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const data = await postJson(url, {}, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  }, timeoutMs);
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  return (parts && parts.map((p) => p.text || '').join('')) || '';
}

/**
 * @param {object} p { provider, apiKey, model, system, user, maxTokens? }
 * @returns {Promise<string>} texto da resposta do modelo
 */
async function chat({ provider, apiKey, model, system, user, maxTokens = 600, timeoutMs = TIMEOUT_MS }) {
  if (!apiKey) {
    const e = new Error('IA não configurada: defina o provedor e a chave em Configurações.');
    e.code = 'AI_OFF';
    throw e;
  }
  const p = provider || 'anthropic';
  if (p === 'anthropic') return anthropic({ apiKey, model, system, user, maxTokens, timeoutMs });
  if (p === 'gemini') return gemini({ apiKey, model, system, user, maxTokens, timeoutMs });
  if (OPENAI_COMPAT_BASE[p]) return openaiCompat(p, { apiKey, model, system, user, maxTokens, timeoutMs });
  throw new Error(`Provedor de IA desconhecido: ${p}`);
}

/**
 * Lista os modelos disponíveis para a chave informada, no provedor dado.
 * @param {object} p { provider, apiKey }
 * @returns {Promise<string[]>} ids de modelo (filtrados p/ chat onde aplicável)
 */
async function listModels({ provider, apiKey, timeoutMs = TIMEOUT_MS }) {
  if (!apiKey) {
    const e = new Error('Informe a chave para listar os modelos.');
    e.code = 'AI_OFF';
    throw e;
  }
  const p = provider || 'anthropic';

  // Gemini: lista por query-key; filtra os que suportam generateContent.
  if (p === 'gemini') {
    const data = await getJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {}, timeoutMs);
    const ids = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''));
    return [...new Set(ids.filter(Boolean))].sort();
  }

  // Anthropic: /v1/models (x-api-key).
  if (p === 'anthropic') {
    const data = await getJson('https://api.anthropic.com/v1/models', { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, timeoutMs);
    const ids = (data.data || []).map((m) => m.id).filter(Boolean);
    return [...new Set(ids)].sort();
  }

  // OpenAI / Grok / Groq / DeepSeek: /models (Bearer).
  const base = OPENAI_COMPAT_BASE[p];
  if (!base) throw new Error(`Provedor de IA desconhecido: ${p}`);
  const data = await getJson(`${base}/models`, { Authorization: `Bearer ${apiKey}` }, timeoutMs);
  let ids = (data.data || []).map((m) => m.id).filter(Boolean);
  // OpenAI devolve embeddings/tts/etc. — mantém só os de chat.
  if (p === 'openai') ids = ids.filter((id) => /^(gpt-|o1|o3|o4|chatgpt)/i.test(id));
  return [...new Set(ids)].sort();
}

module.exports = { chat, listModels, OPENAI_COMPAT_BASE };
