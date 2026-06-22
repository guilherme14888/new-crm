const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope, buildCompanyFilter, requireRole, requirePermission, hasPermission } = require('../middleware/acl');
const { SOURCE_DEFS } = require('../ingest/sources');
const marketDocs = require('../marketDocs');
const opportunities = require('../opportunities');
const { suggestContext } = require('../services/keywordContext');
const { getAiConfigPublic, saveAiConfig, loadAiConfig } = require('../services/aiConfig');
const integrations = require('../services/integrations');
const { chat, listModels } = require('../services/llm');
const { v4: uuidv4 } = require('uuid');

// Inteligência de Mercado — agora POR TENANT (company_id).
//   * dados, palavras-chave e config de API são escopados por empresa;
//   * master vê tudo (buildCompanyFilter trata isso).

/** Mapeia uma linha snake_case de market_intelligence → objeto camelCase da API. */
function fmt(r) {
  const f = (v) => (v === null || v === undefined ? null : v);
  const n = (v) => (v === null || v === undefined ? null : parseFloat(v));
  return {
    id: r.id, companyId: f(r.company_id), companyName: f(r.company_name),
    status: f(r.status), etapaItem: f(r.etapa_item), dataUltimaAtual: f(r.data_ultima_atual),
    regiao: f(r.regiao), cnpj: f(r.cnpj), licitador: f(r.licitador), uf: f(r.uf), municipio: f(r.municipio),
    nEdital: f(r.n_edital), nEditalOriginal: f(r.n_edital_original), nProcesso: f(r.n_processo),
    tipoContratacao: f(r.tipo_contratacao), modalidade: f(r.modalidade), nomeSite: f(r.nome_site),
    urlSite: f(r.url_site), idSite: f(r.id_site), prazoEdital: f(r.prazo_edital), dataHoraCertame: f(r.data_hora_certame),
    lote: r.lote === null ? null : Number(r.lote), item: r.item === null ? null : Number(r.item),
    produtoCandidato: f(r.produto_candidato), produto: f(r.produto), produtoLicitado: f(r.produto_licitado),
    quantidade: n(r.quantidade), unidadeOriginal: f(r.unidade_original), mandadoJudicial: f(r.mandado_judicial), meEpp: f(r.me_epp),
    precoEstimadoUnit: n(r.preco_estimado_unit), precoEstimadoTotal: n(r.preco_estimado_total),
    posicao: r.posicao === null ? null : Number(r.posicao), dataPosicao: f(r.data_posicao),
    concorrente: f(r.concorrente), cnpjConcorrente: f(r.cnpj_concorrente), ufConcorrente: f(r.uf_concorrente),
    produtoOfertado: f(r.produto_ofertado), precoFinalUnit: n(r.preco_final_unit), precoFinalTotal: n(r.preco_final_total),
    etapaSessao: f(r.etapa_sessao), encerramento: f(r.encerramento), processoKey: f(r.processo_key),
    linkEdital: f(r.link_edital), linkAta: f(r.link_ata), linkDocConcorrente: f(r.link_doc_concorrente),
    fonte: f(r.fonte), fontes: f(r.fontes),   // origem do registro (PNCP, BLL…) e todas as origens acumuladas
  };
}

// GET /api/market-intelligence  → linhas do tenant (master vê todas)
router.get('/', auth, resolveScope, requirePermission('market_intelligence_access'), async (req, res) => {
  try {
    const { where, params } = buildCompanyFilter(req.scope, 'mi');
    const [rows] = await db.query(
      `SELECT mi.*, c.name AS company_name
         FROM market_intelligence mi
         LEFT JOIN companies c ON c.id = mi.company_id
        WHERE ${where}
        ORDER BY mi.first_seen_date DESC, mi.ingested_at DESC, mi.id DESC`,
      params
    );
    res.json(rows.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/market-intelligence/opportunities/sync — cria deals BLOQUEADOS (etapa
// "Oportunidade") para as licitações abertas ainda não convertidas. Idempotente.
router.post('/opportunities/sync', auth, resolveScope, async (req, res) => {
  try {
    res.json(await opportunities.syncOpportunities(req.scope));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  Cobertura / Saúde da Coleta (monitoramento da varredura PNCP)
// ════════════════════════════════════════════════════════════════════════════
const todayBRT = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const fmtBR = (d) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');

/** Linha de cobertura do banco → objeto camelCase. */
function fmtCov(r) {
  let byUf = {};
  try { byUf = r.by_uf ? (typeof r.by_uf === 'string' ? JSON.parse(r.by_uf) : r.by_uf) : {}; } catch { byUf = {}; }
  return {
    runDate: r.run_date ? String(r.run_date).slice(0, 10) : null,
    source: r.source,
    enumerated: Number(r.enumerated || 0),
    preFiltered: Number(r.pre_filtered || 0),
    matched: Number(r.matched || 0),
    records: Number(r.records || 0),
    inserted: Number(r.inserted || 0),
    updated: Number(r.updated || 0),
    enumErrors: Number(r.enum_errors || 0),
    byUf,
    modalidades: r.modalidades || null,
    finishedAt: r.finished_at || null,
  };
}

/** Deriva alertas de cobertura a partir do histórico + baseline. */
function computeCoverageAlerts(history, lastRunDate) {
  const alerts = [];
  const last = history[0];
  if (!last) {
    alerts.push({ level: 'info', code: 'NO_SWEEP', message: 'Nenhuma varredura registrada ainda — assim que a coleta rodar (ou o PNCP voltar), as métricas aparecem aqui.' });
    return alerts;
  }
  if (last.enumErrors > 0) alerts.push({ level: 'error', code: 'PNCP_ERRORS', message: `A última varredura teve ${last.enumErrors} erro(s) de enumeração — PNCP instável; a cobertura do dia pode estar incompleta.` });
  if (last.enumerated === 0) alerts.push({ level: 'error', code: 'PNCP_DOWN', message: 'A última varredura não enumerou nenhuma contratação (PNCP indisponível?).' });
  if (last.runDate && last.runDate !== todayBRT()) alerts.push({ level: 'warn', code: 'STALE', message: `A última varredura foi em ${fmtBR(last.runDate)} — ainda não rodou hoje.` });

  // queda de volume vs. média das varreduras anteriores com dados
  const prev = history.slice(1).filter((h) => h.records > 0).slice(0, 7);
  if (prev.length >= 3) {
    const avg = prev.reduce((a, h) => a + h.records, 0) / prev.length;
    if (avg > 0 && last.records < avg * 0.5) {
      alerts.push({ level: 'warn', code: 'LOW_VOLUME', message: `Volume da última varredura (${last.records}) ~${Math.round((1 - last.records / avg) * 100)}% abaixo da média recente (${Math.round(avg)}).` });
    }
  }

  // UFs que apareciam nas últimas varreduras e sumiram na última
  const trailing = new Set();
  history.slice(1, 8).forEach((h) => Object.keys(h.byUf || {}).forEach((u) => trailing.add(u)));
  const lastUfs = new Set(Object.keys(last.byUf || {}));
  const missing = [...trailing].filter((u) => !lastUfs.has(u));
  if (missing.length) alerts.push({ level: 'warn', code: 'UF_MISSING', message: `UF(s) que apareciam recentemente e sumiram na última varredura: ${missing.join(', ')}.` });

  if (!alerts.length) alerts.push({ level: 'ok', code: 'OK', message: 'Cobertura saudável: última varredura completa, sem anomalias.' });
  return alerts;
}

// GET /api/market-intelligence/coverage — saúde da coleta (varredura PNCP) do tenant
router.get('/coverage', auth, resolveScope, requirePermission('coverage_view'), async (req, res) => {
  try {
    const companyId = req.scope.companyId;
    const [cov] = await db.query(
      'SELECT * FROM market_intelligence_coverage WHERE company_id = ? ORDER BY run_date DESC LIMIT 30',
      [companyId]
    );
    const history = cov.map(fmtCov);

    const [ufRows] = await db.query(
      "SELECT uf, COUNT(*) n FROM market_intelligence WHERE company_id = ? AND uf IS NOT NULL AND uf <> '' GROUP BY uf",
      [companyId]
    );
    const baselineByUf = {};
    for (const r of ufRows) baselineByUf[r.uf] = Number(r.n);

    const [runLog] = await db.query(
      "SELECT DATE_FORMAT(MAX(run_date),'%Y-%m-%d') d FROM market_intelligence_run_log WHERE company_id = ?",
      [companyId]
    );
    const lastRunDate = (runLog[0] && runLog[0].d) || null;

    res.json({
      last: history[0] || null,
      history,
      baselineByUf,
      lastRunDate,
      today: todayBRT(),
      alerts: computeCoverageAlerts(history, lastRunDate),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/market-intelligence/mining-history — o que cada palavra-chave coletou de
// NOVO por dia (first_seen_date × termo_busca). Acesso gated por mining_history_view
// (somente admin ou perfil com a permissão). Master vê todos os tenants (?company).
router.get('/mining-history', auth, resolveScope, async (req, res) => {
  try {
    const MASTER = '00000000-0000-0000-0000-000000000001';
    // Gate (ACL): operador Default (empresa REAL = master + admin) sempre vê; demais
    // (inclusive admin de filha) só com o grant mining_history_view no perfil.
    const [urow] = await db.query('SELECT company_id, role, acl_profile_id FROM users WHERE id = ?', [req.user.id]);
    const u0 = urow[0] || {};
    const userIsMaster = u0.company_id === MASTER && u0.role === 'admin';   // operador Default (home)
    let allowed = userIsMaster;
    if (!allowed && u0.acl_profile_id) {
      const [pr] = await db.query('SELECT permissions FROM acl_profiles WHERE id = ?', [u0.acl_profile_id]);
      const perms = pr.length ? (typeof pr[0].permissions === 'string' ? JSON.parse(pr[0].permissions) : (pr[0].permissions || {})) : {};
      allowed = !!(perms && perms.mining_history_view === true);
    }
    if (!allowed) return res.status(403).json({ error: 'Sem permissão para ver o Histórico de Mineração.' });

    const companyParam = req.query.company;
    // O seletor "Todas as empresas" só aparece p/ o operador Default (userIsMaster) e NÃO
    // muda quando ele escolhe uma tenant — por isso persiste na Default e não aparece nas
    // filhas. Os DADOS seguem a tenant selecionada (companyParam); filha vê só a própria.
    // Conjunto de empresas a exibir (null = todas). Operador Default: uma tenant ou todas;
    // membro de equipe da Default: só os tenants da equipe (allowedTenants); demais: a própria.
    const allowedTenants = req.scope.allowedTenants;
    let filterCompanies = null;
    if (userIsMaster) {
      filterCompanies = (companyParam && companyParam !== 'all') ? [companyParam] : null;
    } else if (allowedTenants && allowedTenants.length) {
      filterCompanies = allowedTenants;
    } else {
      filterCompanies = [u0.company_id];
    }
    const inClause = (alias) => {
      if (!filterCompanies) return { sql: '', params: [] };
      const ph = filterCompanies.map(() => '?').join(',');
      return { sql: `${alias}company_id IN (${ph})`, params: [...filterCompanies] };
    };
    let where = 'mi.first_seen_date IS NOT NULL';
    const params = [];
    { const f = inClause('mi.'); if (f.sql) { where += ` AND ${f.sql}`; params.push(...f.params); } }
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(mi.first_seen_date,'%Y-%m-%d') d,
              COALESCE(NULLIF(mi.termo_busca,''),'(varredura)') termo,
              mi.company_id companyId, c.name companyName, COUNT(*) n
         FROM market_intelligence mi
         LEFT JOIN companies c ON c.id = mi.company_id
        WHERE ${where}
        GROUP BY d, termo, mi.company_id, c.name
        ORDER BY d DESC`,
      params
    );
    let companies = [];
    if (userIsMaster) {
      const [cs] = await db.query(
        `SELECT mi.company_id id, c.name name
           FROM market_intelligence mi LEFT JOIN companies c ON c.id = mi.company_id
          WHERE mi.company_id IS NOT NULL
          GROUP BY mi.company_id, c.name ORDER BY c.name`
      );
      companies = cs.map((x) => ({ id: x.id, name: x.name || x.id }));
    }

    // ── Monitoria diária (guia de acompanhamento manual) ─────────────────────
    // Une cobertura (varredura: enumeradas/pré-filtradas/erros) + run_log (totais
    // inseridas/atualizadas/status). Janela fixa de 30 dias, ZERO-FILLED: dias sem
    // coleta aparecem como "sem execução" (para o usuário enxergar as lacunas).
    const DAYS = 30;
    const cWhere = []; const cParams = [];
    { const f = inClause(''); if (f.sql) { cWhere.push(f.sql); cParams.push(...f.params); } }
    const cFilter = cWhere.length ? `AND ${cWhere.join(' AND ')}` : '';
    const [cov] = await db.query(
      `SELECT DATE_FORMAT(run_date,'%Y-%m-%d') d,
              SUM(enumerated) varridas, SUM(pre_filtered) pre, SUM(matched) matched,
              SUM(records) records, SUM(inserted) ins, SUM(updated) upd, SUM(enum_errors) err
         FROM market_intelligence_coverage
        WHERE run_date >= DATE_SUB(CURDATE(), INTERVAL ${DAYS} DAY) ${cFilter}
        GROUP BY d`, cParams);
    const [rl] = await db.query(
      `SELECT DATE_FORMAT(run_date,'%Y-%m-%d') d,
              SUM(inserted) ins, SUM(updated) upd, GROUP_CONCAT(DISTINCT status) status
         FROM market_intelligence_run_log
        WHERE run_date >= DATE_SUB(CURDATE(), INTERVAL ${DAYS} DAY) ${cFilter}
        GROUP BY d`, cParams);
    const covMap = {}; cov.forEach((r) => { covMap[r.d] = r; });
    const rlMap = {}; rl.forEach((r) => { rlMap[r.d] = r; });
    const today = new Date(Date.now() - 3 * 3600 * 1000); // BRT
    const daily = [];
    for (let i = 0; i < DAYS; i++) {
      const dt = new Date(today); dt.setUTCDate(dt.getUTCDate() - i);
      const date = dt.toISOString().slice(0, 10);
      const c = covMap[date]; const r = rlMap[date];
      daily.push({
        date,
        varridas:     c ? Number(c.varridas) || 0 : 0,
        preFiltradas: c ? Number(c.pre) || 0 : 0,
        inseridas:    r ? Number(r.ins) || 0 : (c ? Number(c.ins) || 0 : 0),
        atualizadas:  r ? Number(r.upd) || 0 : (c ? Number(c.upd) || 0 : 0),
        erros:        c ? Number(c.err) || 0 : 0,
        status:       r ? r.status : (c ? 'parcial' : 'sem execução'),
      });
    }

    res.json({
      isMaster: userIsMaster,
      companies,
      daily,
      rows: rows.map((r) => ({ date: r.d, termo: r.termo, companyId: r.companyId, companyName: r.companyName || r.companyId, count: Number(r.n) })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/market-intelligence/:id/history — linha do tempo de uma licitação/item
// (transições de status/situação/posição/vencedor/preço). Escopo por tenant.
router.get('/:id/history', auth, resolveScope, async (req, res) => {
  try {
    const { where, params } = buildCompanyFilter(req.scope, 'mi');
    const [mi] = await db.query(
      `SELECT mi.id FROM market_intelligence mi WHERE mi.id = ? AND ${where}`,
      [req.params.id, ...params]
    );
    if (!mi.length) return res.status(404).json({ error: 'Não encontrado' });
    const [rows] = await db.query(
      `SELECT status, encerramento, etapa_sessao, posicao, concorrente, cnpj_concorrente,
              preco_final_unit, preco_final_total, snapshot_at, run_date
         FROM market_intelligence_history
        WHERE mi_id = ? ORDER BY snapshot_at ASC, id ASC`,
      [req.params.id]
    );
    const n = (v) => (v === null || v === undefined ? null : parseFloat(v));
    res.json(rows.map((h) => ({
      status: h.status ?? null, encerramento: h.encerramento ?? null, etapaSessao: h.etapa_sessao ?? null,
      posicao: h.posicao === null ? null : Number(h.posicao),
      concorrente: h.concorrente ?? null, cnpjConcorrente: h.cnpj_concorrente ?? null,
      precoFinalUnit: n(h.preco_final_unit), precoFinalTotal: n(h.preco_final_total),
      snapshotAt: h.snapshot_at ?? null, runDate: h.run_date ?? null,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/market-intelligence/:id/docs — disponibilidade de edital/ata (metadado barato)
router.get('/:id/docs', auth, resolveScope, async (req, res) => {
  try {
    const { where, params } = buildCompanyFilter(req.scope, 'mi');
    const [rows] = await db.query(
      `SELECT mi.company_id, mi.pncp_controle, mi.url_site FROM market_intelligence mi WHERE mi.id = ? AND ${where}`,
      [req.params.id, ...params]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    const r = rows[0];
    const ctrl = marketDocs.parseControle(r.url_site);
    const [cached] = await db.query(
      'SELECT tipo FROM market_intelligence_docs WHERE company_id <=> ? AND pncp_controle = ?',
      [r.company_id ?? null, r.pncp_controle]
    );
    const have = new Set(cached.map((c) => c.tipo));
    const avail = ctrl ? await marketDocs.availability(ctrl.cnpj, ctrl.ano, ctrl.seq) : { edital: false, ata: false };
    res.json({ edital: have.has('edital') || avail.edital, ata: have.has('ata') || avail.ata });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Helper: carrega a linha (escopada) e devolve { company_id, pncp_controle, ctrl }
async function loadMiRow(req) {
  const { where, params } = buildCompanyFilter(req.scope, 'mi');
  const [rows] = await db.query(
    `SELECT mi.company_id, mi.pncp_controle, mi.url_site FROM market_intelligence mi WHERE mi.id = ? AND ${where}`,
    [req.params.id, ...params]
  );
  if (!rows.length) return null;
  return { ...rows[0], ctrl: marketDocs.parseControle(rows[0].url_site) };
}

// GET /:id/doc/:tipo — lista os arquivos (PDFs) do edital/ata (baixa+extrai do PNCP no 1º acesso)
router.get('/:id/doc/:tipo', auth, resolveScope, async (req, res) => {
  const tipo = req.params.tipo === 'ata' ? 'ata' : 'edital';
  try {
    const row = await loadMiRow(req);
    if (!row) return res.status(404).json({ error: 'Não encontrado' });
    if (!row.ctrl) return res.json({ files: [] });
    const files = await marketDocs.listFiles(row.company_id, row.pncp_controle, tipo, row.ctrl);
    res.json({ files });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id/doc/:tipo/file/:idx — serve os bytes de um arquivo específico (inline se PDF)
router.get('/:id/doc/:tipo/file/:idx', auth, resolveScope, async (req, res) => {
  const tipo = req.params.tipo === 'ata' ? 'ata' : 'edital';
  const idx = parseInt(req.params.idx, 10) || 0;
  try {
    const row = await loadMiRow(req);
    if (!row) return res.status(404).json({ error: 'Não encontrado' });
    if (!row.ctrl) return res.status(404).json({ error: 'Documento indisponível' });
    const f = await marketDocs.getFile(row.company_id, row.pncp_controle, tipo, idx, row.ctrl);
    if (!f) return res.status(404).json({ error: 'Documento indisponível no PNCP' });
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Disposition', `${f.viewable ? 'inline' : 'attachment'}; filename="${encodeURIComponent(f.filename)}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(f.buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  Palavras-Chave (por tenant)
// ════════════════════════════════════════════════════════════════════════════
/** Mapeia uma palavra-chave do banco → objeto camelCase da API. */
function fmtKw(r) {
  return {
    id: r.id, termo: r.termo, produtoCandidato: r.produto_candidato ?? null,
    contexto: r.contexto ?? null, negativos: r.negativos ?? null, ativo: !!r.ativo,
  };
}

// GET /api/market-intelligence/keywords
router.get('/keywords', auth, resolveScope, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM market_intelligence_keywords WHERE company_id = ? ORDER BY termo',
      [req.scope.companyId]
    );
    res.json(rows.map(fmtKw));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/market-intelligence/keywords/suggest — IA sugere contexto + negativos
router.post('/keywords/suggest', auth, resolveScope, async (req, res) => {
  const { termo, produtoCandidato, negocio } = req.body || {};
  if (!termo || !termo.trim()) return res.status(400).json({ error: 'termo é obrigatório' });
  try {
    const out = await suggestContext(req.scope.companyId, { termo: termo.trim(), produto: produtoCandidato, negocio });
    res.json(out);
  } catch (e) {
    const code = e.code === 'AI_OFF' ? 503 : 502;
    res.status(code).json({ error: e.message });
  }
});

// POST /api/market-intelligence/keywords
router.post('/keywords', auth, resolveScope, requirePermission('keywords_manage'), async (req, res) => {
  const { termo, produtoCandidato, contexto, negativos, ativo } = req.body || {};
  if (!termo || !termo.trim()) return res.status(400).json({ error: 'termo é obrigatório' });
  // Governança: uma palavra-chave ATIVA precisa de contexto (senão capta ruído /
  // perde itens). Cadastre inativa ou defina o contexto para ativar.
  if (ativo !== false && !(contexto && contexto.trim())) {
    return res.status(422).json({ error: 'Defina o "contexto do negócio" para ativar a palavra-chave (ou cadastre-a inativa).' });
  }
  const id = uuidv4();
  try {
    await db.query(
      `INSERT INTO market_intelligence_keywords (id, company_id, termo, produto_candidato, contexto, negativos, ativo)
       VALUES (?,?,?,?,?,?,?)`,
      [id, req.scope.companyId, termo.trim(), produtoCandidato || null, contexto || null, negativos || null, ativo === false ? 0 : 1]
    );
    const [rows] = await db.query('SELECT * FROM market_intelligence_keywords WHERE id = ?', [id]);
    res.status(201).json(fmtKw(rows[0]));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Palavra-chave já existe' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/market-intelligence/keywords/:id
router.patch('/keywords/:id', auth, resolveScope, requirePermission('keywords_manage'), async (req, res) => {
  const map = { termo: 'termo', produtoCandidato: 'produto_candidato', contexto: 'contexto', negativos: 'negativos', ativo: 'ativo' };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (req.body[k] !== undefined) {
      sets.push(`${col} = ?`);
      vals.push(k === 'ativo' ? (req.body[k] ? 1 : 0) : (req.body[k] === '' ? null : req.body[k]));
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });
  try {
    // Governança: bloqueia deixar/ficar ATIVA sem contexto. Calcula o estado
    // EFETIVO após o patch (valores enviados sobrepõem os atuais).
    const [cur] = await db.query(
      'SELECT contexto, ativo FROM market_intelligence_keywords WHERE id = ? AND company_id = ?',
      [req.params.id, req.scope.companyId]
    );
    if (!cur.length) return res.status(404).json({ error: 'Não encontrada' });
    const effAtivo = req.body.ativo !== undefined ? !!req.body.ativo : !!cur[0].ativo;
    const effContexto = req.body.contexto !== undefined ? String(req.body.contexto || '').trim() : (cur[0].contexto || '').trim();
    if (effAtivo && !effContexto) {
      return res.status(422).json({ error: 'Defina o "contexto do negócio" para manter a palavra-chave ativa.' });
    }

    vals.push(req.params.id, req.scope.companyId);
    const [r] = await db.query(
      `UPDATE market_intelligence_keywords SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`, vals
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Não encontrada' });

    // Se o rótulo (produto_candidato) mudou, re-sincroniza as linhas já capturadas
    // por esta palavra-chave — assim a correção aparece na hora, sem esperar a
    // próxima ingestão (evita o caso "editei a keyword mas o produto não atualizou").
    if (req.body.produtoCandidato !== undefined) {
      const [kwRows] = await db.query(
        'SELECT termo, produto_candidato FROM market_intelligence_keywords WHERE id = ? AND company_id = ?',
        [req.params.id, req.scope.companyId]
      );
      if (kwRows[0]) {
        await db.query(
          'UPDATE market_intelligence SET produto_candidato = ? WHERE company_id = ? AND termo_busca = ?',
          [kwRows[0].produto_candidato ?? null, req.scope.companyId, kwRows[0].termo]
        );
      }
    }
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Palavra-chave já existe' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/market-intelligence/keywords/:id
router.delete('/keywords/:id', auth, resolveScope, requirePermission('keywords_manage'), async (req, res) => {
  try {
    const [r] = await db.query(
      'DELETE FROM market_intelligence_keywords WHERE id = ? AND company_id = ?',
      [req.params.id, req.scope.companyId]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Não encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  API Externa (fontes/portais) — por tenant; gerente+ pode editar
// ════════════════════════════════════════════════════════════════════════════
router.get('/sources', auth, resolveScope, requireRole('manager'), requirePermission('portals_manage'), async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT source_key, name, enabled, config, updated_at FROM market_intelligence_sources WHERE company_id = ?',
      [req.scope.companyId]
    );
    const byKey = Object.fromEntries(rows.map((r) => {
      let cfg = {}; try { cfg = r.config ? JSON.parse(r.config) : {}; } catch { cfg = {}; }
      return [r.source_key, { enabled: !!r.enabled, config: cfg, updatedAt: r.updated_at }];
    }));
    const sources = SOURCE_DEFS.map((d) => {
      const state = byKey[d.key] || { enabled: d.key === 'pncp', config: {}, updatedAt: null };
      return {
        key: d.key, name: d.name, mode: d.mode, implemented: d.implemented, note: d.note,
        fields: d.fields, enabled: state.enabled, config: state.config, updatedAt: state.updatedAt,
      };
    });
    res.json(sources);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/market-intelligence/sources/:key  body: { enabled?, config? }
router.patch('/sources/:key', auth, resolveScope, requireRole('manager'), requirePermission('portals_manage'), async (req, res) => {
  const def = SOURCE_DEFS.find((d) => d.key === req.params.key);
  if (!def) return res.status(404).json({ error: 'Portal desconhecido' });
  const companyId = req.scope.companyId;
  const { enabled, config } = req.body || {};

  // estado atual para preservar campos não enviados
  const [cur] = await db.query(
    'SELECT enabled, config FROM market_intelligence_sources WHERE company_id = ? AND source_key = ?',
    [companyId, req.params.key]
  );
  let curCfg = {}; try { curCfg = cur[0]?.config ? JSON.parse(cur[0].config) : {}; } catch { curCfg = {}; }
  const curEnabled = cur[0] ? !!cur[0].enabled : (def.key === 'pncp');

  const nextEnabled = enabled !== undefined ? (enabled ? 1 : 0) : (curEnabled ? 1 : 0);
  let nextCfg = curCfg;
  if (config !== undefined) {
    nextCfg = {};
    for (const fld of def.fields) {
      nextCfg[fld.key] = config[fld.key] !== undefined ? config[fld.key] : (curCfg[fld.key] ?? '');
    }
  }
  try {
    await db.query(
      `INSERT INTO market_intelligence_sources (company_id, source_key, name, enabled, config)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), config = VALUES(config)`,
      [companyId, def.key, def.name, nextEnabled, JSON.stringify(nextCfg)]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  Inteligência Artificial — config GLOBAL, só admin da empresa Default/master
// ════════════════════════════════════════════════════════════════════════════
// A IA é única para todo o sistema (uma chave usada por todos os tenants na
// captação). Por isso, só administradores da empresa Default podem ver/editar.
function requireMasterAdmin(req, res, next) {
  if (req.scope && req.scope.isMaster && req.scope.role === 'admin') return next();
  return res.status(403).json({ error: 'Disponível apenas para administradores da empresa Default.' });
}

// GET — estado atual (NUNCA devolve a chave, só se existe) + lista de provedores.
router.get('/ai', auth, resolveScope, requireMasterAdmin, async (req, res) => {
  try {
    res.json(await getAiConfigPublic());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH — salva provedor / chave / modelo. Chave vazia mantém a atual.
router.patch('/ai', auth, resolveScope, requireMasterAdmin, async (req, res) => {
  const { provider, apiKey, model } = req.body || {};
  try {
    res.json(await saveAiConfig(null, { provider, apiKey, model }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── CAPTCHA (2Captcha) — chave global, usada pelo scrape-worker. Só master admin.
router.get('/captcha', auth, resolveScope, requireMasterAdmin, async (req, res) => {
  try {
    const hasKey = (await integrations.hasSecret('captcha_2captcha')) || !!process.env.CAPTCHA_API_KEY;
    res.json({ hasKey, source: (await integrations.hasSecret('captcha_2captcha')) ? 'config' : (process.env.CAPTCHA_API_KEY ? 'env' : 'none') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.patch('/captcha', auth, resolveScope, requireMasterAdmin, async (req, res) => {
  try {
    if (req.body && req.body.apiKey !== undefined) await integrations.setSecret('captcha_2captcha', req.body.apiKey);
    const hasKey = (await integrations.hasSecret('captcha_2captcha')) || !!process.env.CAPTCHA_API_KEY;
    res.json({ ok: true, hasKey });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /ai/models — lista os modelos disponíveis para a chave (usa a chave enviada
// ou, se vazia, a já salva). Permite popular a lista suspensa antes de salvar.
router.post('/ai/models', auth, resolveScope, requireMasterAdmin, async (req, res) => {
  const { provider, apiKey } = req.body || {};
  try {
    let key = apiKey && String(apiKey).trim();
    let prov = provider;
    if (!key) {
      const ai = await loadAiConfig(req.scope.companyId);
      key = ai.apiKey;
      prov = provider || ai.provider;
    }
    if (!key) return res.status(503).json({ error: 'Informe a chave para listar os modelos.' });
    const models = await listModels({ provider: prov, apiKey: key });
    res.json({ models });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// POST /ai/test — valida a config fazendo uma chamada mínima ao provedor.
router.post('/ai/test', auth, resolveScope, requireMasterAdmin, async (req, res) => {
  try {
    const ai = await loadAiConfig();
    if (!ai.apiKey) return res.status(503).json({ ok: false, error: 'Nenhuma chave configurada (nem no .env).' });
    const txt = await chat({
      provider: ai.provider, apiKey: ai.apiKey, model: ai.model,
      system: 'Responda apenas com a palavra OK.', user: 'teste de conexão', maxTokens: 8,
    });
    res.json({ ok: true, provider: ai.provider, model: ai.model, source: ai.source, reply: (txt || '').trim().slice(0, 40) });
  } catch (e) { res.status(502).json({ ok: false, error: e.message }); }
});

module.exports = router;
