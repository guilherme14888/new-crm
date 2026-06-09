const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope, buildCompanyFilter } = require('../middleware/acl');
const { v4: uuidv4 } = require('uuid');

/** Formata um registro de campo customizado para o objeto de API (faz parse das options JSON). */
function fmtField(r) {
  return {
    id: r.id, entityType: r.entity_type, name: r.name,
    fieldType: r.field_type, options: r.options ? JSON.parse(r.options) : null,
    fieldOrder: r.field_order, isRequired: !!r.is_required, isActive: !!r.is_active,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** Formata um valor de campo customizado de um deal para o objeto de API. */
function fmtValue(r) {
  return { id: r.id, dealId: r.deal_id, fieldId: r.field_id, value: r.value ?? null };
}

// GET /api/custom-fields — lista os campos customizados ativos da empresa por tipo de entidade (default: deal)
router.get('/', auth, resolveScope, async (req, res) => {
  try {
    const { entityType = 'deal' } = req.query;
    const { where, params } = buildCompanyFilter(req.scope);
    const [rows] = await db.query(
      `SELECT * FROM custom_fields WHERE entity_type = ? AND is_active = 1 AND ${where} ORDER BY field_order`,
      [entityType, ...params]
    );
    res.json(rows.map(fmtField));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/custom-fields — cria um campo customizado (ordem calculada a partir da contagem existente)
router.post('/', auth, resolveScope, async (req, res) => {
  const { name, fieldType, entityType = 'deal', options, isRequired = false } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = uuidv4();
  const companyId = req.scope.companyId;
  try {
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS c FROM custom_fields WHERE entity_type = ? AND company_id = ?`,
      [entityType, companyId]
    );
    const order = countRows[0].c;
    await db.query(
      `INSERT INTO custom_fields (id, company_id, entity_type, name, field_type, options, field_order, is_required) VALUES (?,?,?,?,?,?,?,?)`,
      [id, companyId, entityType, name, fieldType ?? 'text', options ? JSON.stringify(options) : null, order, isRequired ? 1 : 0]
    );
    const [rows] = await db.query('SELECT * FROM custom_fields WHERE id = ?', [id]);
    res.status(201).json(fmtField(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/custom-fields/:id — atualiza campos parciais de um campo customizado (valida acesso à empresa)
router.patch('/:id', auth, resolveScope, async (req, res) => {
  if (!req.scope.isAdmin && !req.scope.isMaster) {
    const [rows] = await db.query('SELECT company_id FROM custom_fields WHERE id = ?', [req.params.id]);
    if (!rows.length || rows[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
  }
  const map = { name: 'name', fieldType: 'field_type', fieldOrder: 'field_order', isRequired: 'is_required', isActive: 'is_active' };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (req.body[k] !== undefined) { sets.push(`${col} = ?`); vals.push(req.body[k]); }
  }
  if (req.body.options !== undefined) { sets.push('options = ?'); vals.push(JSON.stringify(req.body.options)); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.params.id);
  try {
    await db.query(`UPDATE custom_fields SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/custom-fields/:id — desativa o campo customizado (is_active = 0), exclusão lógica
router.delete('/:id', auth, resolveScope, async (req, res) => {
  if (!req.scope.isAdmin && !req.scope.isMaster) {
    const [rows] = await db.query('SELECT company_id FROM custom_fields WHERE id = ?', [req.params.id]);
    if (!rows.length || rows[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
  }
  try {
    await db.query(`UPDATE custom_fields SET is_active = 0 WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/custom-fields/values/:dealId — lista os valores de campos customizados de um deal
router.get('/values/:dealId', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM deal_custom_values WHERE deal_id = ?`, [req.params.dealId]);
    res.json(rows.map(fmtValue));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/custom-fields/values/:dealId  — upsert array of { fieldId, value }
router.put('/values/:dealId', auth, async (req, res) => {
  const { values } = req.body;
  if (!Array.isArray(values)) return res.status(400).json({ error: 'values must be array' });
  try {
    for (const { fieldId, value } of values) {
      const [exist] = await db.query(
        `SELECT id FROM deal_custom_values WHERE deal_id = ? AND field_id = ?`,
        [req.params.dealId, fieldId]
      );
      if (exist.length) {
        await db.query(`UPDATE deal_custom_values SET value = ? WHERE deal_id = ? AND field_id = ?`,
          [value, req.params.dealId, fieldId]);
      } else {
        await db.query(`INSERT INTO deal_custom_values (id, deal_id, field_id, value) VALUES (?,?,?,?)`,
          [uuidv4(), req.params.dealId, fieldId, value]);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
