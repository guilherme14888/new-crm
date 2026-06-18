const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { resolveScope, requireRole, requirePermission } = require('../middleware/acl');

// Formata uma linha de perfil de ACL para a API, anexando os funis vinculados
function fmtProfile(r, funnelIds = []) {
  let permissions = r.permissions;
  if (typeof permissions === 'string') permissions = JSON.parse(permissions);
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    description: r.description ?? null,
    level: Number(r.level),
    color: r.color,
    permissions,
    funnelIds,
    isSystem: !!r.is_system,
    isActive: !!r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// GET /api/acl-profiles — lista os perfis de ACL da empresa e os perfis de sistema
router.get('/', auth, resolveScope, async (req, res) => {
  try {
    const companyId = req.scope.companyId;
    const [rows] = await db.query(
      `SELECT * FROM acl_profiles WHERE company_id = ? OR is_system = 1 ORDER BY level ASC, name ASC`,
      [companyId]
    );
    const ids = rows.map((r) => r.id);
    let funnelMap = {};
    if (ids.length) {
      const [fRows] = await db.query(
        `SELECT acl_profile_id, funnel_id FROM acl_profile_funnels WHERE acl_profile_id IN (?)`,
        [ids]
      );
      for (const fr of fRows) {
        if (!funnelMap[fr.acl_profile_id]) funnelMap[fr.acl_profile_id] = [];
        funnelMap[fr.acl_profile_id].push(fr.funnel_id);
      }
    }
    res.json(rows.map((r) => fmtProfile(r, funnelMap[r.id] ?? [])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/acl-profiles — cria um perfil de ACL com permissões e funis (admin/manager)
router.post('/', auth, resolveScope, requireRole('admin', 'manager'), requirePermission('roles_manage'), async (req, res) => {
  const { name, description, level = 1, color = '#64748b', permissions, funnelIds = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!permissions) return res.status(400).json({ error: 'permissions required' });
  const id = uuidv4();
  const companyId = req.scope.companyId;
  try {
    await db.query(
      `INSERT INTO acl_profiles (id, company_id, name, description, level, color, permissions, is_system) VALUES (?,?,?,?,?,?,?,0)`,
      [id, companyId, name, description ?? null, level, color, JSON.stringify(permissions)]
    );
    if (funnelIds.length) {
      const values = funnelIds.map((fid) => [id, fid]);
      await db.query(`INSERT INTO acl_profile_funnels (acl_profile_id, funnel_id) VALUES ?`, [values]);
    }
    const [rows] = await db.query(`SELECT * FROM acl_profiles WHERE id = ?`, [id]);
    res.status(201).json(fmtProfile(rows[0], funnelIds));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/acl-profiles/:id — atualiza um perfil de ACL e seus funis vinculados (admin/manager)
router.patch('/:id', auth, resolveScope, requireRole('admin', 'manager'), requirePermission('roles_manage'), async (req, res) => {
  const { name, description, level, color, permissions, funnelIds } = req.body;
  const sets = [], vals = [];
  if (name !== undefined)        { sets.push('name = ?');        vals.push(name); }
  if (description !== undefined) { sets.push('description = ?'); vals.push(description ?? null); }
  if (level !== undefined)       { sets.push('level = ?');       vals.push(level); }
  if (color !== undefined)       { sets.push('color = ?');       vals.push(color); }
  if (permissions !== undefined) { sets.push('permissions = ?'); vals.push(JSON.stringify(permissions)); }
  if (!sets.length && funnelIds === undefined) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.params.id);
  try {
    if (sets.length) {
      await db.query(`UPDATE acl_profiles SET ${sets.join(', ')} WHERE id = ?`, vals);
    }
    if (funnelIds !== undefined) {
      await db.query(`DELETE FROM acl_profile_funnels WHERE acl_profile_id = ?`, [req.params.id]);
      if (funnelIds.length) {
        const values = funnelIds.map((fid) => [req.params.id, fid]);
        await db.query(`INSERT INTO acl_profile_funnels (acl_profile_id, funnel_id) VALUES ?`, [values]);
      }
    }
    const [rows] = await db.query(`SELECT * FROM acl_profiles WHERE id = ?`, [req.params.id]);
    const [fRows] = await db.query(`SELECT funnel_id FROM acl_profile_funnels WHERE acl_profile_id = ?`, [req.params.id]);
    res.json(fmtProfile(rows[0], fRows.map((f) => f.funnel_id)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/acl-profiles/:id — exclui um perfil de ACL (exceto perfis de sistema) e desvincula usuários (admin/manager)
router.delete('/:id', auth, resolveScope, requireRole('admin', 'manager'), requirePermission('roles_manage'), async (req, res) => {
  const [existing] = await db.query(`SELECT * FROM acl_profiles WHERE id = ?`, [req.params.id]);
  if (!existing.length) return res.status(404).json({ error: 'Profile not found' });
  if (existing[0].is_system) return res.status(403).json({ error: 'Não é possível excluir perfil do sistema' });
  try {
    await db.query(`DELETE FROM acl_profile_funnels WHERE acl_profile_id = ?`, [req.params.id]);
    await db.query(`UPDATE users SET acl_profile_id = NULL WHERE acl_profile_id = ?`, [req.params.id]);
    await db.query(`DELETE FROM acl_profiles WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
