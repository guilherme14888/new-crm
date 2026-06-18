const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope, buildScopeFilter, buildCompanyFilter, canAccess, requirePermission, hasPermission, permissionDenied } = require('../middleware/acl');
const { audit } = require('../services/auditLog');
const opportunities = require('../opportunities');

/**
 * Formata um registro de deal do banco para o objeto de API.
 * Converte snake_case para camelCase e trata null/undefined.
 * @param row Linha da tabela deals
 * @returns Objeto Deal formatado para resposta JSON
 */
/** Extrai o produto do campo notes ("Produtos: X") das oportunidades de licitação. */
function extractProduto(notes) {
  if (!notes) return null;
  const m = String(notes).match(/^\s*Produtos?:\s*(.+?)\s*$/im);
  const v = m && m[1].trim();
  return v && v !== '—' ? v : null;
}

function fmt(row) {
  if (!row) return null;
  return {
    id: row.id, contactId: row.contact_id,
    funnelId: row.funnel_id, stageId: row.stage_id,
    ownerId: row.owner_id ?? null, title: row.title,
    value: row.value, currency: row.currency,
    stage: row.stage, stageOrder: row.stage_order,
    probability: row.probability,
    expectedCloseDate: row.expected_close_date ?? null,
    closingReason: row.closing_reason ?? null,
    notes: row.notes ?? null,
    produto: extractProduto(row.notes),
    stageChangedAt: row.stage_changed_at ?? null,
    locked: !!row.locked,
    miControle: row.mi_controle ?? null,
    companyId: row.company_id,
    companyName: row.company_name ?? null,
    createdAt: row.created_at, updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null, syncStatus: 'synced',
  };
}

/**
 * GET /api/deals
 * Lista deals respeitando escopo de acesso do usuário.
 * Filtra por company_id e owner_id conforme a função e escopo.
 */
router.get('/', auth, resolveScope, async (req, res) => {
  // leads_view_all: enxerga toda a empresa (ignora restrição de equipe/dono)
  const viewAll = await hasPermission(req, 'leads_view_all');
  const { where, params } = viewAll ? buildCompanyFilter(req.scope, 'd') : buildScopeFilter(req.scope, 'd');
  try {
    const [rows] = await db.query(
      `SELECT d.*, c.name AS company_name FROM deals d LEFT JOIN companies c ON c.id = d.company_id WHERE d.deleted_at IS NULL AND ${where} ORDER BY d.stage_order`,
      params
    );
    res.json(rows.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * GET /api/deals/:id
 * Retorna um deal específico, verificando permissão de acesso.
 */
router.get('/:id', auth, resolveScope, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT d.*, c.name AS company_name FROM deals d LEFT JOIN companies c ON c.id = d.company_id WHERE d.id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (!canAccess(req.scope, rows[0]))
      return res.status(403).json({ error: 'Acesso negado' });
    res.json(fmt(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/deals
 * Cria um novo deal. Owner padrão é o usuário logado.
 * Calcula stage_order automaticamente como max + 1 no estágio.
 */
router.post('/', auth, resolveScope, async (req, res) => {
  const {
    id, contactId, funnelId, stageId, ownerId,
    title, value, currency, stage, probability,
    expectedCloseDate, closingReason, notes,
  } = req.body;
  // Owner padrão é o usuário criando o deal
  const effectiveOwner = ownerId ?? req.scope.userId;
  // Allow overriding company when creating from Default/master company
  const companyId = req.body.companyId || req.scope.companyId;
  try {
    const [maxRow] = await db.query(
      `SELECT MAX(stage_order) AS max_order FROM deals WHERE stage_id = ? AND deleted_at IS NULL`,
      [stageId || stage]
    );
    const stageOrder = (maxRow[0].max_order ?? 0) + 1;
    await db.query(
      `INSERT INTO deals
         (id,company_id,contact_id,funnel_id,stage_id,owner_id,title,value,currency,
          stage,stage_order,probability,expected_close_date,closing_reason,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, companyId, contactId, funnelId ?? 'default-funnel', stageId ?? '',
       effectiveOwner, title, value ?? 0, currency ?? 'BRL',
       stage ?? 'qualification', stageOrder, probability ?? 10,
       expectedCloseDate ?? null, closingReason ?? null, notes ?? null]
    );
    const [rows] = await db.query('SELECT d.*, c.name AS company_name FROM deals d LEFT JOIN companies c ON c.id = d.company_id WHERE d.id = ?', [id]);
    audit(req, { action: 'create', resource: 'deals', resourceId: id, newValue: { title, value, companyId } });
    res.status(201).json(fmt(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * PATCH /api/deals/:id
 * Atualiza campos de um deal (título, valor, estágio, etc.).
 * Valida permissão de acesso antes de atualizar.
 */
router.patch('/:id', auth, resolveScope, async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM deals WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (!canAccess(req.scope, existing[0]))
      return res.status(403).json({ error: 'Acesso negado' });

    const map = {
      title: 'title', value: 'value', stage: 'stage',
      stageId: 'stage_id', funnelId: 'funnel_id', ownerId: 'owner_id',
      companyId: 'company_id',
      probability: 'probability', expectedCloseDate: 'expected_close_date',
      closingReason: 'closing_reason', notes: 'notes',
    };
    const sets = [], vals = [];
    for (const [jsKey, col] of Object.entries(map)) {
      if (req.body[jsKey] !== undefined) { sets.push(`${col} = ?`); vals.push(req.body[jsKey]); }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    vals.push(req.params.id);
    await db.query(`UPDATE deals SET ${sets.join(', ')} WHERE id = ?`, vals);
    audit(req, { action: 'update', resource: 'deals', resourceId: req.params.id, oldValue: fmt(existing[0]), newValue: req.body });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * PATCH /api/deals/:id/move
 * Move um deal para um novo estágio com nova ordem de visualização.
 * Atualiza stage_changed_at com timestamp atual.
 */
router.patch('/:id/move', auth, resolveScope, async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM deals WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (!canAccess(req.scope, existing[0]))
      return res.status(403).json({ error: 'Acesso negado' });
    if (existing[0].locked)
      return res.status(423).json({ error: 'Licitação bloqueada — clique em "Participar" para liberar a negociação.' });

    const { newStage, newStageId, newOrder } = req.body;
    // Reabrir negociação GANHA (won → não-won) exige leads_reopen_won. Restritivo:
    // só barra quem tem perfil com a flag desligada (sem perfil/admin passam).
    try {
      const newSid = newStageId ?? newStage;
      const [stypes] = await db.query('SELECT id, type FROM funnel_stages WHERE id IN (?, ?)', [existing[0].stage_id, newSid]);
      const typeOf = (id) => (stypes.find((s) => s.id === id) || {}).type;
      if (typeOf(existing[0].stage_id) === 'won' && typeOf(newSid) !== 'won' && await permissionDenied(req, 'leads_reopen_won')) {
        return res.status(403).json({ error: 'Sem permissão para reabrir negociações ganhas (mover para em andamento).' });
      }
    } catch { /* tipo indeterminado → não bloqueia */ }
    await db.query(
      `UPDATE deals SET stage = ?, stage_id = ?, stage_order = ?, stage_changed_at = NOW() WHERE id = ?`,
      [newStage, newStageId ?? newStage, newOrder, req.params.id]
    );
    audit(req, { action: 'update', resource: 'deals', resourceId: req.params.id, newValue: { stage: newStage } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * DELETE /api/deals/:id
 * Soft delete — marca deal como deletado (deleted_at = NOW()).
 * Dados permanecem no banco para auditoria.
 */
router.delete('/:id', auth, resolveScope, requirePermission('leads_delete'), async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM deals WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (!canAccess(req.scope, existing[0]))
      return res.status(403).json({ error: 'Acesso negado' });
    await db.query('UPDATE deals SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    audit(req, { action: 'delete', resource: 'deals', resourceId: req.params.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/deals/:id/participate — desbloqueia a oportunidade (move + copia docs)
router.post('/:id/participate', auth, resolveScope, async (req, res) => {
  try {
    const [d] = await db.query('SELECT * FROM deals WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (!d.length) return res.status(404).json({ error: 'Not found' });
    if (!canAccess(req.scope, d[0])) return res.status(403).json({ error: 'Acesso negado' });
    const r = await opportunities.participate(req.scope, req.params.id);
    audit(req, { action: 'update', resource: 'deals', resourceId: req.params.id, newValue: { participate: true } });
    res.json(r);
  } catch (e) {
    if (e.code === 'NF') return res.status(404).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  Arquivos do deal (aba "Arquivos") — edital/ata copiados + uploads manuais
// ════════════════════════════════════════════════════════════════════════════
const { v4: uuidv4 } = require('uuid');
const marketDocs = require('../marketDocs');

/** Lista os arquivos de edital/ata do PNCP da licitação de origem (mi_controle). */
async function pncpFilesFor(deal) {
  if (!deal.mi_controle) return [];
  let ctrl = null;
  try {
    const [mi] = await db.query('SELECT url_site FROM market_intelligence WHERE pncp_controle = ? LIMIT 1', [deal.mi_controle]);
    if (mi.length) ctrl = marketDocs.parseControle(mi[0].url_site);
  } catch { return []; }
  if (!ctrl) return [];
  const out = [];
  for (const tipo of ['edital', 'ata']) {
    try {
      const files = await marketDocs.listFiles(deal.company_id, deal.mi_controle, tipo, ctrl);
      files.forEach((f) => out.push({
        id: `pncp:${tipo}:${f.idx}`, fileName: f.name, mimeType: f.mime, fileSize: f.size,
        kind: tipo, viewable: !!f.viewable, url: null, source: 'pncp', createdAt: null,
      }));
    } catch { /* tipo indisponível no PNCP — ignora */ }
  }
  return out;
}

/** Carrega o deal e valida acesso; retorna a linha ou responde erro. */
async function dealOr403(req, res) {
  const [rows] = await db.query('SELECT * FROM deals WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!rows.length) { res.status(404).json({ error: 'Not found' }); return null; }
  if (!canAccess(req.scope, rows[0])) { res.status(403).json({ error: 'Acesso negado' }); return null; }
  return rows[0];
}

// GET /api/deals/:id/files — lista (sem o blob): edital/ata do PNCP + uploads/links
router.get('/:id/files', auth, resolveScope, async (req, res) => {
  try {
    const deal = await dealOr403(req, res);
    if (!deal) return;
    const [files] = await db.query(
      `SELECT id, file_name, mime_type, file_size, kind, viewable, file_url, created_at
         FROM deal_files WHERE deal_id = ? ORDER BY kind, created_at`,
      [req.params.id]
    );
    const dealFiles = files.map((f) => ({
      id: f.id, fileName: f.file_name, mimeType: f.mime_type, fileSize: f.file_size,
      kind: f.kind || 'outro', viewable: !!f.viewable,
      url: f.file_url || null, source: 'deal', createdAt: f.created_at,
    }));
    // edital/ata do PNCP sempre presentes (não removíveis); à frente os uploads.
    let pncp = [];
    try { pncp = await pncpFilesFor(deal); } catch { /* best-effort */ }
    res.json([...pncp, ...dealFiles]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/deals/:id/files/:fileId/content — serve os bytes (inline se PDF).
// Para ids "pncp:tipo:idx", busca/serve o edital/ata do PNCP (cache).
router.get('/:id/files/:fileId/content', auth, resolveScope, async (req, res) => {
  try {
    const deal = await dealOr403(req, res);
    if (!deal) return;
    const fid = req.params.fileId;

    if (fid.startsWith('pncp:')) {
      const [, tipo, idxStr] = fid.split(':');
      const idx = parseInt(idxStr, 10) || 0;
      let ctrl = null;
      if (deal.mi_controle) {
        const [mi] = await db.query('SELECT url_site FROM market_intelligence WHERE pncp_controle = ? LIMIT 1', [deal.mi_controle]);
        if (mi.length) ctrl = marketDocs.parseControle(mi[0].url_site);
      }
      if (!ctrl) return res.status(404).json({ error: 'Documento indisponível' });
      const f = await marketDocs.getFile(deal.company_id, deal.mi_controle, tipo, idx, ctrl);
      if (!f) return res.status(404).json({ error: 'Documento indisponível no PNCP' });
      res.setHeader('Content-Type', f.mime || 'application/octet-stream');
      res.setHeader('Content-Disposition', `${f.viewable ? 'inline' : 'attachment'}; filename="${encodeURIComponent(f.filename || 'documento')}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.send(f.buf);
    }

    const [rows] = await db.query(
      'SELECT file_name, mime_type, viewable, conteudo FROM deal_files WHERE id = ? AND deal_id = ?',
      [fid, req.params.id]
    );
    if (!rows.length || !rows[0].conteudo) return res.status(404).json({ error: 'Arquivo não encontrado' });
    const f = rows[0];
    res.setHeader('Content-Type', f.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${f.viewable ? 'inline' : 'attachment'}; filename="${encodeURIComponent(f.file_name || 'arquivo')}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(f.conteudo);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/deals/:id/files — anexa um arquivo: categoria (kind) + nome + arquivo
// (dataBase64) OU link externo (url).
router.post('/:id/files', auth, resolveScope, async (req, res) => {
  try {
    if (!(await dealOr403(req, res))) return;
    const { fileName, name, mime, dataBase64, url, kind } = req.body || {};
    const nm = String(name || fileName || '').trim();
    // categoria livre, normalizada (edital/ata/proposta/contrato/outro…)
    const k = (String(kind || 'outro').toLowerCase().replace(/[^a-z0-9_]+/g, '').slice(0, 30)) || 'outro';
    const id = uuidv4();

    // Link externo
    if (url && String(url).trim()) {
      const u = String(url).trim().slice(0, 1000);
      const viewable = /\.pdf(\?|$)/i.test(u) ? 1 : 0;
      await db.query(
        `INSERT INTO deal_files (id, deal_id, file_name, file_url, file_size, mime_type, uploaded_by, kind, viewable, conteudo)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, req.params.id, (nm || u).slice(0, 250), u, 0, viewable ? 'application/pdf' : 'text/uri-list', req.scope.userId, k, viewable, null]
      );
      return res.status(201).json({ ok: true, id });
    }

    // Upload de arquivo
    if (!nm || !dataBase64) return res.status(400).json({ error: 'Informe o nome e o arquivo (ou um link externo).' });
    const buf = Buffer.from(String(dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
    const isPdf = buf.slice(0, 5).toString('latin1') === '%PDF-';
    await db.query(
      `INSERT INTO deal_files (id, deal_id, file_name, file_url, file_size, mime_type, uploaded_by, kind, viewable, conteudo)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, req.params.id, nm.slice(0, 250), '', buf.length, mime || (isPdf ? 'application/pdf' : 'application/octet-stream'), req.scope.userId, k, isPdf ? 1 : 0, buf]
    );
    res.status(201).json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/deals/:id/files/:fileId
router.delete('/:id/files/:fileId', auth, resolveScope, async (req, res) => {
  try {
    if (!(await dealOr403(req, res))) return;
    await db.query('DELETE FROM deal_files WHERE id = ? AND deal_id = ?', [req.params.fileId, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
