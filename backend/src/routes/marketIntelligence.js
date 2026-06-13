const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope, buildCompanyFilter, requireRole } = require('../middleware/acl');
const { SOURCE_DEFS } = require('../ingest/sources');
const marketDocs = require('../marketDocs');
const opportunities = require('../opportunities');
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
  };
}

// GET /api/market-intelligence  → linhas do tenant (master vê todas)
router.get('/', auth, resolveScope, async (req, res) => {
  try {
    const { where, params } = buildCompanyFilter(req.scope, 'mi');
    const [rows] = await db.query(
      `SELECT mi.*, c.name AS company_name
         FROM market_intelligence mi
         LEFT JOIN companies c ON c.id = mi.company_id
        WHERE ${where}
        ORDER BY mi.data_hora_certame DESC, mi.processo_key, mi.lote, mi.item`,
      params
    );
    res.json(rows.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/market-intelligence/opportunities — inbox de licitações abertas não convertidas
router.get('/opportunities', auth, resolveScope, async (req, res) => {
  try {
    res.json(await opportunities.listOpportunities(req.scope.companyId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/market-intelligence/opportunities/confirm  body { controle } → cria o deal
router.post('/opportunities/confirm', auth, resolveScope, async (req, res) => {
  try {
    const dealId = await opportunities.confirmParticipation(req.scope, req.body?.controle);
    res.status(201).json({ ok: true, dealId });
  } catch (e) {
    if (e.code === 'DUP') return res.status(409).json({ error: e.message, dealId: e.dealId });
    if (e.code === 'NF')  return res.status(404).json({ error: e.message });
    if (e.code === 'BAD') return res.status(400).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
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

// POST /api/market-intelligence/keywords
router.post('/keywords', auth, resolveScope, async (req, res) => {
  const { termo, produtoCandidato, contexto, negativos, ativo } = req.body || {};
  if (!termo || !termo.trim()) return res.status(400).json({ error: 'termo é obrigatório' });
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
router.patch('/keywords/:id', auth, resolveScope, async (req, res) => {
  const map = { termo: 'termo', produtoCandidato: 'produto_candidato', contexto: 'contexto', negativos: 'negativos', ativo: 'ativo' };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (req.body[k] !== undefined) {
      sets.push(`${col} = ?`);
      vals.push(k === 'ativo' ? (req.body[k] ? 1 : 0) : (req.body[k] === '' ? null : req.body[k]));
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });
  vals.push(req.params.id, req.scope.companyId);
  try {
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
router.delete('/keywords/:id', auth, resolveScope, async (req, res) => {
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
router.get('/sources', auth, resolveScope, requireRole('manager'), async (req, res) => {
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
router.patch('/sources/:key', auth, resolveScope, requireRole('manager'), async (req, res) => {
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

module.exports = router;
