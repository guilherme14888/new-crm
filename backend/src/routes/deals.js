const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope, buildScopeFilter, canAccess } = require('../middleware/acl');
const { audit } = require('../services/auditLog');

/**
 * Formata um registro de deal do banco para o objeto de API.
 * Converte snake_case para camelCase e trata null/undefined.
 * @param row Linha da tabela deals
 * @returns Objeto Deal formatado para resposta JSON
 */
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
    stageChangedAt: row.stage_changed_at ?? null,
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
  const { where, params } = buildScopeFilter(req.scope, 'd');
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

    const { newStage, newStageId, newOrder } = req.body;
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
router.delete('/:id', auth, resolveScope, async (req, res) => {
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

module.exports = router;
