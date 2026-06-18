// Cliente LLM agnóstico de provedor. Uma única função chat() que fala com
// Anthropic (Claude), OpenAI (GPT), Google (Gemini), xAI (Grok) e DeepSeek.
// Recebe sistema + mensagem do usuário e devolve o texto da resposta.
//
// OpenAI, Grok e DeepSeek compartilham o mesmo formato (Chat Completions),
// mudando só a base URL. Anthropic e Gemini têm formato próprio.

// Bases compatíveis com a API da OpenAI (mesmo corpo/headers).
const OPENAI_COMPAT_BASE = {
  openai:   'https://api.openai.com/v1',
  grok:     'https://api.x.ai/v1',
  deepseek: 'https://api.deepseek.com/v1',
};

const TIMEOUT_MS = 40000;

async function postJson(url, headers, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
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
  } finally {
    clearTimeout(t);
  }
}

// ── Anthropic (Claude) ────────────────────────────────────────────────────────
async function anthropic({ apiKey, model, system, user, maxTokens }) {
  const data = await postJson('https://api.anthropic.com/v1/messages', {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }, {
    model,
    max_tokens: maxTokens,
    // bloco de regras constante → cache_control reaproveita tokens de entrada
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  });
  return (data && data.content && data.content[0] && data.content[0].text) || '';
}

// ── OpenAI / Grok / DeepSeek (formato Chat Completions) ───────────────────────
async function openaiCompat(provider, { apiKey, model, system, user, maxTokens }) {
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
  });
  return (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

// ── Google (Gemini) ───────────────────────────────────────────────────────────
async function gemini({ apiKey, model, system, user, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const data = await postJson(url, {}, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  });
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  return (parts && parts.map((p) => p.text || '').join('')) || '';
}

/**
 * @param {object} p { provider, apiKey, model, system, user, maxTokens? }
 * @returns {Promise<string>} texto da resposta do modelo
 */
async function chat({ provider, apiKey, model, system, user, maxTokens = 600 }) {
  if (!apiKey) {
    const e = new Error('IA não configurada: defina o provedor e a chave em Configurações.');
    e.code = 'AI_OFF';
    throw e;
  }
  const p = provider || 'anthropic';
  if (p === 'anthropic') return anthropic({ apiKey, model, system, user, maxTokens });
  if (p === 'gemini') return gemini({ apiKey, model, system, user, maxTokens });
  if (OPENAI_COMPAT_BASE[p]) return openaiCompat(p, { apiKey, model, system, user, maxTokens });
  throw new Error(`Provedor de IA desconhecido: ${p}`);
}

module.exports = { chat, OPENAI_COMPAT_BASE };
