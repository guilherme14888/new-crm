const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope, buildCompanyFilter } = require('../middleware/acl');

function fmt(row) {
  return {
    id: row.id, type: row.type, label: row.label,
    isActive: !!row.is_active, createdAt: row.created_at,
  };
}

// GET /api/win-loss-reasons
router.get('/', auth, resolveScope, async (req, res) => {
  try {
    const { where, params } = buildCompanyFilter(req.scope);
    const [rows] = await db.query(
      `SELECT * FROM win_loss_reasons WHERE is_active = 1 AND ${where} ORDER BY type, label`,
      params
    );
    res.json(rows.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/win-loss-reasons
router.post('/', auth, resolveScope, async (req, res) => {
  const { id, type, label } = req.body;
  const companyId = req.scope.companyId;
  try {
    await db.query(
      `INSERT INTO win_loss_reasons (id, company_id, type, label, is_active) VALUES (?, ?, ?, ?, 1)`,
      [id, companyId, type, label]
    );
    const [rows] = await db.query('SELECT * FROM win_loss_reasons WHERE id = ?', [id]);
    res.status(201).json(fmt(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/win-loss-reasons/:id
router.patch('/:id', auth, resolveScope, async (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'label required' });

  if (!req.scope.isAdmin && !req.scope.isMaster) {
    const [rows] = await db.query('SELECT company_id FROM win_loss_reasons WHERE id = ?', [req.params.id]);
    if (!rows.length || rows[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
  }

  try {
    await db.query('UPDATE win_loss_reasons SET label = ? WHERE id = ?', [label, req.params.id]);
    const [rows] = await db.query('SELECT * FROM win_loss_reasons WHERE id = ?', [req.params.id]);
    res.json(fmt(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/win-loss-reasons/:id  (soft disable)
router.delete('/:id', auth, resolveScope, async (req, res) => {
  if (!req.scope.isAdmin && !req.scope.isMaster) {
    const [rows] = await db.query('SELECT company_id FROM win_loss_reasons WHERE id = ?', [req.params.id]);
    if (!rows.length || rows[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
  }
  try {
    await db.query('UPDATE win_loss_reasons SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
