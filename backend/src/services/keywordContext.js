// Assistente de IA para configurar palavras-chave de captação de licitações.
// Dado o TERMO (e, opcionalmente, o rótulo do produto e uma linha sobre o negócio),
// sugere:
//   • contexto — frase curta que guia a IA de relevância (o que ENCAIXA no negócio);
//   • negativos — termos de itens que compartilham a palavra mas NÃO interessam
//     (homônimos / usos adjacentes), para descarte determinístico barato (camada T0).
//
// Usa o provedor de IA configurado pelo tenant nas Configurações (services/aiConfig)
// via cliente agnóstico (services/llm) — Anthropic, OpenAI, Gemini, Grok ou DeepSeek.

const { chat } = require('./llm');
const { loadAiConfig } = require('./aiConfig');

const SYSTEM = [
  'Você ajuda a configurar a captação automática de licitações públicas no Brasil.',
  'Dado um TERMO de busca e o negócio do fornecedor, devolva DOIS itens:',
  '1) "contexto": uma frase objetiva (1–2 linhas) que descreve QUAIS itens de licitação',
  '   realmente interessam — categoria/uso correto do produto. Esse texto guia uma IA',
  '   classificadora; seja específico (inclua o que pertence e, se útil, o que não pertence).',
  '2) "negativos": lista de termos que aparecem em itens que apenas COMPARTILHAM a palavra',
  '   mas são de outra categoria (homônimos, usos adjacentes), para descarte automático.',
  'Pense em variações de grafia, sinônimos e produtos vizinhos.',
  'Exemplo — termo "pneu" para fabricante de pneus automotivos:',
  '  contexto: "Pneus para veículos automotores (automóveis, motocicletas, caminhões e ônibus).',
  '            Não inclui pneus de equipamentos manuais nem câmaras de ar avulsas."',
  '  negativos: ["carrinho de mão","carriola","obra","bicicleta","brinquedo","cadeira de rodas","maca","câmara de ar"]',
  'Responda SOMENTE um JSON no formato {"contexto":"...","negativos":["...","..."]} — sem texto fora do JSON.',
].join('\n');

/**
 * @param {string} companyId  tenant (define qual provedor/chave usar)
 * @param {object} p          { termo, produto?, negocio? }
 * @returns {Promise<{ contexto: string, negativos: string }>}  negativos como CSV
 */
async function suggestContext(companyId, { termo, produto, negocio }) {
  const ai = await loadAiConfig(companyId);
  if (!ai.apiKey) {
    const e = new Error('Sugestão por IA indisponível: configure um provedor de IA em Configurações → Inteligência Artificial.');
    e.code = 'AI_OFF';
    throw e;
  }

  const userMsg =
    `TERMO BUSCADO: ${termo}\n` +
    `RÓTULO/PRODUTO: ${produto || '(não informado)'}\n` +
    `NEGÓCIO DO FORNECEDOR: ${negocio || '(não informado — infira pelo termo/produto)'}\n\n` +
    'Gere o contexto do negócio e a lista de negativos.';

  const txt = (await chat({
    provider: ai.provider, apiKey: ai.apiKey, model: ai.model,
    system: SYSTEM, user: userMsg, maxTokens: 600,
  })).trim();

  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Resposta da IA sem JSON reconhecível.');
  let parsed;
  try { parsed = JSON.parse(m[0]); } catch { throw new Error('Resposta da IA não é JSON válido.'); }

  const contexto = String(parsed.contexto || '').trim();
  const neg = Array.isArray(parsed.negativos) ? parsed.negativos : String(parsed.negativos || '').split(',');
  const negativos = neg.map((s) => String(s).trim()).filter(Boolean).join(', ');
  return { contexto, negativos };
}

module.exports = { suggestContext };
