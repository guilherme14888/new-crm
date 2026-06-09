const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope, buildCompanyFilter } = require('../middleware/acl');
const { audit } = require('../services/auditLog');

/** Formata uma linha da tabela contacts (snake_case) para o objeto Contact da API (camelCase). */
function fmt(row) {
  if (!row) return null;
  return {
    id: row.id, type: row.type,
    firstName: row.first_name, lastName: row.last_name,
    email: row.email, phone: row.phone,
    company: row.company, jobTitle: row.job_title,
    avatarUrl: row.avatar_url,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags ?? []),
    notes: row.notes,
    companyId: row.company_id,
    createdAt: row.created_at, updatedAt: row.updated_at,
    deletedAt: row.deleted_at, syncStatus: 'synced',
  };
}

// GET /api/contacts
router.get('/', auth, resolveScope, async (req, res) => {
  const { where, params } = buildCompanyFilter(req.scope);
  try {
    const [rows] = await db.query(
      `SELECT * FROM contacts WHERE deleted_at IS NULL AND ${where} ORDER BY first_name, last_name`,
      params
    );
    res.json(rows.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/contacts/search?q=
router.get('/search', auth, resolveScope, async (req, res) => {
  const q = `%${req.query.q ?? ''}%`;
  const { where, params } = buildCompanyFilter(req.scope);
  try {
    const [rows] = await db.query(
      `SELECT * FROM contacts WHERE deleted_at IS NULL AND ${where}
       AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company LIKE ?)
       ORDER BY first_name, last_name LIMIT 50`,
      [...params, q, q, q, q]
    );
    res.json(rows.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/contacts
router.post('/', auth, resolveScope, async (req, res) => {
  const { id, type, firstName, lastName, email, phone, company, jobTitle, avatarUrl, tags, notes } = req.body;
  const companyId = req.scope.companyId;
  try {
    await db.query(
      `INSERT INTO contacts (id,company_id,type,first_name,last_name,email,phone,company,job_title,avatar_url,tags,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, companyId, type ?? 'lead', firstName, lastName, email ?? null, phone ?? null,
       company ?? null, jobTitle ?? null, avatarUrl ?? null,
       JSON.stringify(tags ?? []), notes ?? null]
    );
    const [rows] = await db.query('SELECT * FROM contacts WHERE id = ?', [id]);
    audit(req, { action: 'create', resource: 'contacts', resourceId: id, newValue: { firstName, lastName } });
    res.status(201).json(fmt(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/contacts/:id
router.patch('/:id', auth, resolveScope, async (req, res) => {
  try {
    // Verify ownership — contacts are company-scoped
    const [existing] = await db.query('SELECT company_id FROM contacts WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Não encontrado' });
    if (!req.scope.isAdmin && !req.scope.isMaster && existing[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });

    const map = {
      firstName: 'first_name', lastName: 'last_name', email: 'email',
      phone: 'phone', company: 'company', jobTitle: 'job_title',
      avatarUrl: 'avatar_url', notes: 'notes', type: 'type',
    };
    const sets = [], vals = [];
    for (const [jsKey, col] of Object.entries(map)) {
      if (req.body[jsKey] !== undefined) { sets.push(`${col} = ?`); vals.push(req.body[jsKey]); }
    }
    if (req.body.tags !== undefined) { sets.push('tags = ?'); vals.push(JSON.stringify(req.body.tags)); }
    if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    vals.push(req.params.id);
    await db.query(`UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`, vals);
    audit(req, { action: 'update', resource: 'contacts', resourceId: req.params.id, newValue: req.body });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/contacts/:id (soft delete)
router.delete('/:id', auth, resolveScope, async (req, res) => {
  try {
    const [existing] = await db.query('SELECT company_id FROM contacts WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Não encontrado' });
    if (!req.scope.isAdmin && !req.scope.isMaster && existing[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
    await db.query('UPDATE contacts SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    audit(req, { action: 'delete', resource: 'contacts', resourceId: req.params.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
