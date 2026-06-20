// Fonte única das definições dos portais (campos editáveis na UI) + carregamento
// da configuração do banco com fallback no .env.

const db = require('../db');

// Portais SEM conector próprio ainda — entram no catálogo para você REUNIR e
// guardar os LOGINS num só lugar (Configurações → Portais). `implemented:false`
// (a coleta vem por conector sob demanda ou pelo scrape-worker). Campos: login/senha.
const PORTAIS_LOGIN = [
  ['licitacoes_e',    'Portal Licitações-e (Banco do Brasil)', 'https://www.licitacoes-e.com.br'],
  ['bec_sp',          'Portal BEC-SP (Bolsa Eletrônica SP)',   'https://www.bec.sp.gov.br'],
  ['compras_publicas','Portal de Compras Públicas',            'https://www.portaldecompraspublicas.com.br'],
  ['caixa',           'Portal Caixa Econômica Federal',        'http://www.licitacoes.caixa.gov.br'],
  ['bbmnet',          'Bolsa Brasileira de Mercadorias (BBMNet)', 'https://www.bbmnet.com.br'],
  ['petronect',       'Petronect',                             'https://www.petronect.com.br'],
  ['sabesp',          'Sabesp Licitações',                     'http://licitacoes.sabesp.com.br'],
  ['publinexo',       'Portal Publinexo (Bionexo)',            'https://bionexo.com'],
  ['licitanet',       'Portal Licitanet',                      'https://licitanet.com.br'],
  ['diario_mt',       'Diário Oficial Eletrônico Municípios MT', 'https://diariomunicipal.org/mt/amm'],
  ['banrisul',        'Portal Banrisul (Pregão)',              'https://pregaobanrisul.com.br'],
  ['comprasnet_go',   'ComprasNet Goiás',                      'http://www.comprasnet.go.gov.br'],
  ['correios',        'Portal dos Correios',                   'http://www2.correios.com.br/institucional/licitacoes'],
  ['tce_pr',          'Portal TCE Paraná',                     'https://servicos.tce.pr.gov.br'],
  ['famesp',          'Portal Famesp',                         'https://compraeletronica.famesp.org.br'],
  ['sesi',            'Portal do SESI (FIESC)',                'http://transparencia.fiesc.com.br'],
  ['sesc',            'Portal do SESC',                        'http://www.sesc.com.br/portal/sesc/departamentonacional/licitacoes'],
  ['infraero',        'Infraero Aeroportos',                   'https://www4.infraero.gov.br/fornecedor'],
  ['onu',             'Portal Licitações - ONU',               'https://nacoesunidas.org/vagas/licitacoes'],
  ['siga_rj',         'Portal Siga Rio de Janeiro',            'https://www.compras.rj.gov.br/Portal-Siga'],
  ['siga_es',         'Portal Siga Espírito Santo',            'https://compras.es.gov.br'],
  ['compras_mg',      'Portal de Compras Minas Gerais',        'http://www.compras.mg.gov.br'],
  ['compras_ba',      'Portal de Compras Bahia',               'https://www.comprasnet.ba.gov.br'],
  ['compras_pe',      'Portal de Compras Pernambuco',          'http://www.compras.pe.gov.br'],
  ['compras_pr',      'Portal de Compras Paraná',              'http://www.administracao.pr.gov.br/Compras'],
  ['compras_rs',      'Portal de Compras Rio Grande do Sul',   'https://www.compras.rs.gov.br'],
  ['compras_am',      'Portal de Compras Amazonas',            'https://www.e-compras.am.gov.br'],
  ['compras_df',      'Portal de Compras Distrito Federal',    'https://www.compras.df.gov.br'],
  ['compras_curitiba','Portal de Compras Curitiba',            'https://e-compras.curitiba.pr.gov.br'],
  ['celic_rs',        'Portal Celic Rio Grande do Sul',        'http://www.cecom.rs.gov.br'],
  ['compras_rn',      'Portal Rio Grande do Norte (SEARH)',    'http://servicos.searh.rn.gov.br'],
  ['compras_ac',      'Portal de Compras Acre',                'http://www.licitacao.ac.gov.br'],
  ['compras_ap',      'Portal de Compras Amapá',               'https://compras.portal.ap.gov.br'],
  ['compras_ma',      'Portal de Compras Maranhão',            'http://www.compras.ma.gov.br'],
  ['compras_mt',      'Portal de Compras Mato Grosso',         'https://aquisicoes.gestao.mt.gov.br'],
  ['compras_pa',      'Portal de Compras Pará',                'http://www.compraspara.pa.gov.br'],
  ['compras_pb',      'Portal de Compras Paraíba',             'http://www.centraldecompras.pb.gov.br'],
  ['compras_pi',      'Portal de Compras Piauí',               'http://licitacao.administracao.pi.gov.br'],
  ['compras_ro',      'Portal de Compras Rondônia (SUPEL)',    'http://www.rondonia.ro.gov.br/supel'],
  ['compras_to',      'Portal de Compras Tocantins',           'http://www.sgl.to.gov.br'],
  ['compras_se',      'Portal de Compras Sergipe',             'http://www.comprasnet.se.gov.br'],
  ['compras_ms',      'Portal de Compras Mato Grosso do Sul',  'http://www.centraldecompras.ms.gov.br'],
].map(([key, name, url]) => ({
  key, name, mode: 'login', implemented: false,
  note: `${url} — guarde o login aqui. Coleta por conector dedicado ou pelo scrape-worker (sob demanda).`,
  fields: [
    { key: 'username', label: 'Usuário / Login' },
    { key: 'password', label: 'Senha', secret: true },
    { key: 'url', label: 'URL (opcional)', placeholder: url },
  ],
}));

// Definições por portal: quais campos a UI mostra no modal de edição.
// `secret: true` → renderizar como senha. `type: 'textarea'` → multilinha.
const SOURCE_DEFS = [
  {
    key: 'pncp', name: 'PNCP', mode: 'keyword', implemented: true,
    note: 'API pública oficial (busca textual) — não requer credenciais.',
    fields: [],
  },
  {
    key: 'pncp_sweep', name: 'PNCP-Sweep', mode: 'sweep', implemented: true,
    note: 'Varredura COMPLETA do PNCP (enumeração por data+modalidade) — garante cobertura, não depende de busca por palavra-chave. Sem credenciais.',
    fields: [
      { key: 'modalidades', label: 'Modalidades (códigos, ex.: 6,8,9,4)', placeholder: '6,8,9,4' },
      { key: 'lookbackDays', label: 'Dias de janela (cobre atraso de publicação)', placeholder: '3' },
    ],
  },
  {
    key: 'comprasgov', name: 'Compras.gov (failover PNCP)', mode: 'sweep', implemented: true,
    note: 'Redundância do PNCP: mesmas contratações 14.133, em outro host (dadosabertos.compras.gov.br). Só coleta quando o PNCP está em cooldown/penalizado — em dia normal fica ocioso (não duplica). force=true faz backfill manual. Sem credenciais.',
    fields: [
      { key: 'modalidades', label: 'Modalidades (códigos)', placeholder: '6,8,9,4' },
      { key: 'lookbackDays', label: 'Dias de janela', placeholder: '3' },
      { key: 'force', label: 'Forçar coleta mesmo com PNCP ok (true/false)', placeholder: 'false' },
    ],
  },
  {
    key: 'compras_es', name: 'Compras ES (SIGA)', mode: 'keyword', implemented: true,
    note: 'Dados abertos do ES (CKAN), API pública sem credenciais. Aditivo ao PNCP. Atualize o resource_id por ano quando o ES publicar o recurso novo.',
    fields: [
      { key: 'resource_id', label: 'Resource ID (CKAN do ano vigente)', placeholder: 'e48980a6-347b-4285-8b29-11d8210fc0a5' },
    ],
  },
  {
    key: 'compras_ce', name: 'Compras CE (TCE-CE)', mode: 'sweep', implemented: true,
    note: 'Dados abertos do TCE-CE (SIM), API pública sem credenciais. ESCOPO MUNICIPAL: informe os códigos (ex.: 024,053) ou "all" p/ TODOS os 184 municípios (coleta lenta e completa). Funde com o PNCP quando o registro traz o id PNCP.',
    fields: [
      { key: 'municipios', label: 'Municípios CE: códigos ou "all" (todos)', placeholder: 'all' },
      { key: 'lookbackDays', label: 'Dias de janela (por autuação)', placeholder: '30' },
      { key: 'pausaMs', label: 'Pausa entre municípios (ms)', placeholder: '400' },
    ],
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
  ...PORTAIS_LOGIN,
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
