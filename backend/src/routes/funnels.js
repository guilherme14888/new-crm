const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope, buildCompanyFilter } = require('../middleware/acl');

function fmtFunnel(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name,
    companyId: row.company_id ?? null,
    isDefault: !!row.is_default,
    isActive: row.is_active === undefined ? true : !!row.is_active,
    description: row.description ?? null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function fmtStage(row) {
  if (!row) return null;
  return {
    id: row.id, funnelId: row.funnel_id, name: row.name,
    order: row.order_index, color: row.color ?? null,
    probability: row.probability,
    type: row.type ?? 'active',
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

const MASTER_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const { v4: uuidv4 } = require('uuid');

// Helper: get all non-default company IDs
async function getOtherCompanyIds() {
  const [rows] = await db.query('SELECT id FROM companies WHERE id != ? AND is_active = 1', [MASTER_COMPANY_ID]);
  return rows.map((r) => r.id);
}

// GET /api/funnels — always returns Default company funnels (shared across all companies)
router.get('/', auth, resolveScope, async (req, res) => {
  try {
    const [funnels] = await db.query(
      `SELECT * FROM funnels WHERE company_id = ? ORDER BY is_default DESC, name`,
      [MASTER_COMPANY_ID]
    );
    const funnelIds = funnels.map(f => f.id);
    if (!funnelIds.length) return res.json([]);
    const [stages] = await db.query(
      `SELECT * FROM funnel_stages WHERE funnel_id IN (${funnelIds.map(() => '?').join(',')}) ORDER BY order_index`,
      funnelIds
    );
    const result = funnels.map(f => ({
      ...fmtFunnel(f),
      stages: stages.filter(s => s.funnel_id === f.id).map(fmtStage),
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/funnels/:id
router.get('/:id', auth, resolveScope, async (req, res) => {
  try {
    const [funnels] = await db.query(
      `SELECT * FROM funnels WHERE id = ?`,
      [req.params.id]
    );
    if (!funnels[0]) return res.status(404).json({ error: 'Funil não encontrado' });
    const [stages] = await db.query(
      'SELECT * FROM funnel_stages WHERE funnel_id = ? ORDER BY order_index', [req.params.id]
    );
    res.json({ ...fmtFunnel(funnels[0]), stages: stages.map(fmtStage) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/funnels — only Default company can create funnels
router.post('/', auth, resolveScope, async (req, res) => {
  if (req.scope.companyId !== MASTER_COMPANY_ID && !req.scope.isMaster)
    return res.status(403).json({ error: 'Apenas a empresa padrão pode criar funis' });
  const { id, name, isDefault, stages } = req.body;
  const companyId = MASTER_COMPANY_ID;
  try {
    await db.query(
      `INSERT INTO funnels (id, company_id, name, is_default) VALUES (?, ?, ?, ?)`,
      [id, companyId, name, isDefault ? 1 : 0]
    );
    if (Array.isArray(stages)) {
      for (const s of stages) {
        await db.query(
          `INSERT INTO funnel_stages (id, funnel_id, company_id, name, order_index, color, probability, type) VALUES (?,?,?,?,?,?,?,?)`,
          [s.id, id, companyId, s.name, s.order ?? s.order_index ?? 0, s.color ?? null, s.probability ?? 0, s.type ?? 'active']
        );
      }
    }
    // Replicate to all other companies
    const otherIds = await getOtherCompanyIds();
    for (const cid of otherIds) {
      const fid = uuidv4();
      await db.query(
        `INSERT IGNORE INTO funnels (id, company_id, name, is_default) VALUES (?,?,?,?)`,
        [fid, cid, name, isDefault ? 1 : 0]
      );
      if (Array.isArray(stages)) {
        for (const s of stages) {
          await db.query(
            `INSERT IGNORE INTO funnel_stages (id, funnel_id, company_id, name, order_index, color, probability, type) VALUES (?,?,?,?,?,?,?,?)`,
            [uuidv4(), fid, cid, s.name, s.order ?? s.order_index ?? 0, s.color ?? null, s.probability ?? 0, s.type ?? 'active']
          );
        }
      }
    }

    const [rows] = await db.query('SELECT * FROM funnels WHERE id = ?', [id]);
    const [stageRows] = await db.query(
      'SELECT * FROM funnel_stages WHERE funnel_id = ? ORDER BY order_index', [id]
    );
    res.status(201).json({ ...fmtFunnel(rows[0]), stages: stageRows.map(fmtStage) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/funnels/:id — only Default company can edit funnels
router.patch('/:id', auth, resolveScope, async (req, res) => {
  if (req.scope.companyId !== MASTER_COMPANY_ID && !req.scope.isMaster)
    return res.status(403).json({ error: 'Apenas a empresa padrão pode editar funis' });
  const { name, isDefault } = req.body;
  const sets = [], vals = [];
  if (name !== undefined)      { sets.push('name = ?');       vals.push(name); }
  if (isDefault !== undefined) { sets.push('is_default = ?'); vals.push(isDefault ? 1 : 0); }
  if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  vals.push(req.params.id);
  try {
    // Get current name before update to find replicas
    const [current] = await db.query('SELECT name FROM funnels WHERE id = ?', [req.params.id]);
    const oldName = current[0]?.name;
    await db.query(`UPDATE funnels SET ${sets.join(', ')} WHERE id = ?`, vals);
    // Replicate name/isDefault change to other companies' matching funnels
    if (oldName) {
      const replicaSets = [], replicaVals = [];
      if (name !== undefined)      { replicaSets.push('name = ?');       replicaVals.push(name); }
      if (isDefault !== undefined) { replicaSets.push('is_default = ?'); replicaVals.push(isDefault ? 1 : 0); }
      if (replicaSets.length) {
        replicaVals.push(oldName, MASTER_COMPANY_ID);
        await db.query(`UPDATE funnels SET ${replicaSets.join(', ')} WHERE name = ? AND company_id != ?`, replicaVals);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/funnels/:id — only Default company can delete funnels
router.delete('/:id', auth, resolveScope, async (req, res) => {
  if (req.scope.companyId !== MASTER_COMPANY_ID && !req.scope.isMaster)
    return res.status(403).json({ error: 'Apenas a empresa padrão pode excluir funis' });
  try {
    // Get funnel name to find replicas
    const [current] = await db.query('SELECT name FROM funnels WHERE id = ?', [req.params.id]);
    const funnelName = current[0]?.name;
    await db.query('DELETE FROM funnel_stages WHERE funnel_id = ?', [req.params.id]);
    await db.query('DELETE FROM funnels WHERE id = ?', [req.params.id]);
    // Delete replicas in other companies
    if (funnelName) {
      const [replicas] = await db.query('SELECT id FROM funnels WHERE name = ? AND company_id != ?', [funnelName, MASTER_COMPANY_ID]);
      for (const r of replicas) {
        await db.query('DELETE FROM funnel_stages WHERE funnel_id = ?', [r.id]);
        await db.query('DELETE FROM funnels WHERE id = ?', [r.id]);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/funnels/:id/stages
router.post('/:id/stages', auth, resolveScope, async (req, res) => {
  if (req.scope.companyId !== MASTER_COMPANY_ID && !req.scope.isMaster)
    return res.status(403).json({ error: 'Apenas a empresa padrão pode criar etapas' });
  const stageCompanyId = MASTER_COMPANY_ID;
  const { id, name, order, color, probability, type } = req.body;
  try {
    await db.query(
      `INSERT INTO funnel_stages (id, funnel_id, company_id, name, order_index, color, probability, type) VALUES (?,?,?,?,?,?,?,?)`,
      [id, req.params.id, stageCompanyId, name, order ?? 0, color ?? null, probability ?? 0, type ?? 'active']
    );
    // Replicate stage to other companies' matching funnels
    const [parentFunnel] = await db.query('SELECT name FROM funnels WHERE id = ?', [req.params.id]);
    if (parentFunnel[0]) {
      const [replicas] = await db.query('SELECT id, company_id FROM funnels WHERE name = ? AND company_id != ?', [parentFunnel[0].name, MASTER_COMPANY_ID]);
      for (const r of replicas) {
        await db.query(
          `INSERT IGNORE INTO funnel_stages (id, funnel_id, company_id, name, order_index, color, probability, type) VALUES (?,?,?,?,?,?,?,?)`,
          [uuidv4(), r.id, r.company_id, name, order ?? 0, color ?? null, probability ?? 0, type ?? 'active']
        );
      }
    }
    const [rows] = await db.query('SELECT * FROM funnel_stages WHERE id = ?', [id]);
    res.status(201).json(fmtStage(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/funnels/:id/stages/:stageId — only Default company
router.patch('/:id/stages/:stageId', auth, resolveScope, async (req, res) => {
  if (req.scope.companyId !== MASTER_COMPANY_ID && !req.scope.isMaster)
    return res.status(403).json({ error: 'Apenas a empresa padrão pode editar etapas' });
  const map = { name: 'name', order: 'order_index', color: 'color', probability: 'probability', type: 'type' };
  const sets = [], vals = [];
  for (const [jsKey, col] of Object.entries(map)) {
    if (req.body[jsKey] !== undefined) { sets.push(`${col} = ?`); vals.push(req.body[jsKey]); }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  vals.push(req.params.stageId);
  try {
    // Get current stage name to find replicas
    const [currentStage] = await db.query('SELECT name FROM funnel_stages WHERE id = ?', [req.params.stageId]);
    const oldStageName = currentStage[0]?.name;
    await db.query(`UPDATE funnel_stages SET ${sets.join(', ')} WHERE id = ?`, vals);
    // Replicate changes to matching stages in other companies
    if (oldStageName) {
      const replicaSets = [], replicaVals = [];
      for (const [jsKey, col] of Object.entries(map)) {
        if (req.body[jsKey] !== undefined) { replicaSets.push(`${col} = ?`); replicaVals.push(req.body[jsKey]); }
      }
      if (replicaSets.length) {
        replicaVals.push(oldStageName, MASTER_COMPANY_ID);
        await db.query(`UPDATE funnel_stages SET ${replicaSets.join(', ')} WHERE name = ? AND company_id != ?`, replicaVals);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/funnels/:id/stages/:stageId — only Default company
router.delete('/:id/stages/:stageId', auth, resolveScope, async (req, res) => {
  if (req.scope.companyId !== MASTER_COMPANY_ID && !req.scope.isMaster)
    return res.status(403).json({ error: 'Apenas a empresa padrão pode excluir etapas' });
  try {
    // Get stage name to find replicas
    const [currentStage] = await db.query('SELECT name FROM funnel_stages WHERE id = ?', [req.params.stageId]);
    const stageName = currentStage[0]?.name;
    await db.query('DELETE FROM funnel_stages WHERE id = ?', [req.params.stageId]);
    // Delete replicas in other companies
    if (stageName) {
      await db.query('DELETE FROM funnel_stages WHERE name = ? AND company_id != ?', [stageName, MASTER_COMPANY_ID]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
