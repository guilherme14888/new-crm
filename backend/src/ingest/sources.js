// Fonte única das definições dos portais (campos editáveis na UI) + carregamento
// da configuração do banco com fallback no .env.

const db = require('../db');

// Definições por portal: quais campos a UI mostra no modal de edição.
// `secret: true` → renderizar como senha. `type: 'textarea'` → multilinha.
const SOURCE_DEFS = [
  {
    key: 'pncp', name: 'PNCP', mode: 'keyword', implemented: true,
    note: 'API pública oficial — não requer credenciais.',
    fields: [],
  },
  {
    key: 'licitaja', name: 'Licitaja', mode: 'keyword', implemented: true,
    note: 'API REST oficial. Gere a API Key na sua conta Licitaja.',
    fields: [
      { key: 'api_key', label: 'API Key', secret: true },
      { key: 'base_url', label: 'Base URL', placeholder: 'https://www.licitaja.com.br/api/v1' },
    ],
  },
  {
    key: 'bll', name: 'BLL', mode: 'processos', implemented: true,
    note: 'SOAP do órgão promotor — sem busca por palavra-chave. Informe os processos a acompanhar.',
    fields: [
      { key: 'org_key', label: 'Org Key (chave do promotor)', secret: true },
      { key: 'ws_url', label: 'WS URL', placeholder: 'https://lanceinteg.com/ProcessResult.svc' },
      { key: 'processes', label: 'Processos (JSON)', type: 'textarea', placeholder: '[{"number":"005/2016","modalityId":1,"agency":"...","uf":"PR"}]' },
    ],
  },
  {
    key: 'effecti', name: 'Effecti', mode: 'keyword', implemented: false,
    note: 'Conector ainda não implementado — aguardando validação do acesso.',
    fields: [
      { key: 'username', label: 'Usuário' },
      { key: 'password', label: 'Senha', secret: true },
    ],
  },
  {
    key: 'conlicitacao', name: 'Conlicitação', mode: 'keyword', implemented: false,
    note: 'Conector ainda não implementado — preferir token/API.',
    fields: [{ key: 'token', label: 'Token de API', secret: true }],
  },
  {
    key: 'forseti', name: 'Forseti', mode: 'keyword', implemented: false,
    note: 'Conector ainda não implementado.',
    fields: [{ key: 'username', label: 'Usuário' }, { key: 'password', label: 'Senha', secret: true }],
  },
  {
    key: 'comprasbr', name: 'ComprasBR', mode: 'keyword', implemented: false,
    note: 'Conector ainda não implementado.',
    fields: [{ key: 'username', label: 'Usuário' }, { key: 'password', label: 'Senha', secret: true }],
  },
];

const DEF_BY_KEY = Object.fromEntries(SOURCE_DEFS.map((d) => [d.key, d]));

// Fallback de cada campo a partir do .env (compatibilidade / deploy via env).
const ENV_FALLBACK = {
  licitaja: { api_key: 'LICITAJA_API_KEY', base_url: 'LICITAJA_BASE' },
  bll: { org_key: 'BLL_ORG_KEY', ws_url: 'BLL_WS_URL', processes: 'BLL_PROCESSES' },
  effecti: { username: 'EFFECTI_USER', password: 'EFFECTI_PASS' },
  conlicitacao: { token: 'CONLICITACAO_TOKEN' },
  forseti: { username: 'FORSETI_USER', password: 'FORSETI_PASS' },
  comprasbr: { username: 'COMPRASBR_USER', password: 'COMPRASBR_PASS' },
};

/** Preenche campos vazios do config (vindo do banco) com o fallback do .env. */
function mergeEnv(key, config = {}) {
  const merged = { ...config };
  const map = ENV_FALLBACK[key] || {};
  for (const [field, envName] of Object.entries(map)) {
    if (merged[field] === undefined || merged[field] === null || merged[field] === '') {
      if (process.env[envName]) merged[field] = process.env[envName];
    }
  }
  return merged;
}

/** Lê as fontes de uma empresa → { key: { enabled, config(mergedEnv) } } */
async function loadAll(companyId) {
  let rows = [];
  try {
    [rows] = companyId
      ? await db.query('SELECT source_key, enabled, config FROM market_intelligence_sources WHERE company_id = ?', [companyId])
      : await db.query('SELECT source_key, enabled, config FROM market_intelligence_sources');
  } catch { rows = []; }
  const map = {};
  for (const r of rows) {
    let cfg = {};
    try { cfg = r.config ? JSON.parse(r.config) : {}; } catch { cfg = {}; }
    map[r.source_key] = { enabled: !!r.enabled, config: mergeEnv(r.source_key, cfg) };
  }
  // garante presença de todas as defs (caso a tabela esteja vazia)
  for (const d of SOURCE_DEFS) {
    if (!map[d.key]) map[d.key] = { enabled: d.key === 'pncp', config: mergeEnv(d.key, {}) };
  }
  return map;
}

module.exports = { SOURCE_DEFS, DEF_BY_KEY, loadAll, mergeEnv };
