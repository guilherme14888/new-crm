const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope } = require('../middleware/acl');

// GET /api/settings
router.get('/', auth, resolveScope, async (req, res) => {
  try {
    const companyId = req.scope.companyId;
    const [rows] = await db.query(
      `SELECT * FROM app_settings WHERE company_id = ? OR company_id IS NULL ORDER BY company_id DESC`,
      [companyId]
    );
    // Company-specific settings override global ones
    const result = {};
    for (const r of rows) {
      if (!(r.setting_key in result) || r.company_id) {
        result[r.setting_key] = typeof r.setting_value === 'string'
          ? JSON.parse(r.setting_value)
          : r.setting_value;
      }
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/settings/:key
router.get('/:key', auth, resolveScope, async (req, res) => {
  try {
    const companyId = req.scope.companyId;
    const [rows] = await db.query(
      `SELECT * FROM app_settings WHERE setting_key = ? AND (company_id = ? OR company_id IS NULL) ORDER BY company_id DESC LIMIT 1`,
      [req.params.key, companyId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Setting not found' });
    const value = typeof rows[0].setting_value === 'string'
      ? JSON.parse(rows[0].setting_value)
      : rows[0].setting_value;
    res.json({ key: req.params.key, value });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/settings/:key
router.put('/:key', auth, resolveScope, async (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value required' });
  const companyId = req.scope.companyId;
  try {
    await db.query(
      `INSERT INTO app_settings (setting_key, company_id, setting_value) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [req.params.key, companyId, JSON.stringify(value)]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
