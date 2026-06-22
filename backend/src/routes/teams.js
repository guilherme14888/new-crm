const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { resolveScope, buildCompanyFilter, requirePermission } = require('../middleware/acl');

// Formata uma linha de equipe do banco no objeto retornado pela API
function fmtTeam(r) {
  return {
    id: r.id, name: r.name, description: r.description ?? null,
    color: r.color, memberCount: Number(r.member_count ?? 0),
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// Formata uma linha de membro de equipe (com dados do usuário) para a API
function fmtMember(r) {
  return {
    id: r.id, teamId: r.team_id, userId: r.user_id,
    userDisplayName: r.display_name ?? r.user_id,
    userEmail: r.email ?? '',
    role: r.role, joinedAt: r.joined_at,
  };
}

// GET /api/teams — lista as equipes do escopo da empresa com contagem de membros
router.get('/', auth, resolveScope, async (req, res) => {
  try {
    const { where, params } = buildCompanyFilter(req.scope);
    const [rows] = await db.query(
      `SELECT t.*, COUNT(tm.id) AS member_count
       FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.id
       WHERE ${where}
       GROUP BY t.id
       ORDER BY t.name`,
      params
    );
    const teams = rows.map(fmtTeam);
    // Anexa os tenants atribuídos a cada equipe (visualização restrita por equipe).
    if (teams.length) {
      const ids = teams.map((t) => t.id);
      const [tt] = await db.query(
        `SELECT team_id, company_id FROM team_tenants WHERE team_id IN (${ids.map(() => '?').join(',')})`, ids);
      const byTeam = {};
      for (const r of tt) (byTeam[r.team_id] = byTeam[r.team_id] || []).push(r.company_id);
      teams.forEach((t) => { t.tenantIds = byTeam[t.id] || []; });
    }
    res.json(teams);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/teams — cria uma nova equipe na empresa do escopo
router.post('/', auth, resolveScope, requirePermission('teams_manage'), async (req, res) => {
  const { name, description, color = '#3b82f6' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = uuidv4();
  const companyId = req.scope.companyId;
  try {
    await db.query(
      `INSERT INTO teams (id, company_id, name, description, color) VALUES (?,?,?,?,?)`,
      [id, companyId, name, description ?? null, color]
    );
    const [rows] = await db.query(`SELECT t.*, 0 AS member_count FROM teams t WHERE t.id = ?`, [id]);
    res.status(201).json(fmtTeam(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/teams/:id — atualiza nome/descrição/cor de uma equipe
router.patch('/:id', auth, resolveScope, requirePermission('teams_manage'), async (req, res) => {
  if (!req.scope.isAdmin && !req.scope.isMaster) {
    const [rows] = await db.query('SELECT company_id FROM teams WHERE id = ?', [req.params.id]);
    if (!rows.length || rows[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
  }
  const { name, description, color } = req.body;
  const sets = [], vals = [];
  if (name !== undefined)        { sets.push('name = ?');        vals.push(name); }
  if (description !== undefined) { sets.push('description = ?'); vals.push(description ?? null); }
  if (color !== undefined)       { sets.push('color = ?');       vals.push(color); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.params.id);
  try {
    await db.query(`UPDATE teams SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/teams/:id — remove uma equipe
router.delete('/:id', auth, resolveScope, requirePermission('teams_manage'), async (req, res) => {
  if (!req.scope.isAdmin && !req.scope.isMaster) {
    const [rows] = await db.query('SELECT company_id FROM teams WHERE id = ?', [req.params.id]);
    if (!rows.length || rows[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
  }
  try {
    await db.query(`DELETE FROM teams WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/teams/:id/members — lista os membros de uma equipe
router.get('/:id/members', auth, resolveScope, async (req, res) => {
  try {
    if (!req.scope.isAdmin) {
      const [rows] = await db.query('SELECT company_id FROM teams WHERE id = ?', [req.params.id]);
      if (!rows.length || rows[0].company_id !== req.scope.companyId)
        return res.status(403).json({ error: 'Acesso negado' });
    }
    const [rows] = await db.query(`
      SELECT tm.*, u.display_name, u.email
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ?
      ORDER BY tm.joined_at
    `, [req.params.id]);
    res.json(rows.map(fmtMember));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/teams/:id/members — adiciona um usuário à equipe  { userId, role }
router.post('/:id/members', auth, resolveScope, requirePermission('teams_manage'), async (req, res) => {
  if (!req.scope.isAdmin && !req.scope.isMaster) {
    const [rows] = await db.query('SELECT company_id FROM teams WHERE id = ?', [req.params.id]);
    if (!rows.length || rows[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
  }
  const { userId, role = 'member' } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const id = uuidv4();
  try {
    await db.query(`INSERT IGNORE INTO team_members (id, team_id, user_id, role) VALUES (?,?,?,?)`,
      [id, req.params.id, userId, role]);
    const [rows] = await db.query(`
      SELECT tm.*, u.display_name, u.email FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ? AND tm.user_id = ?
    `, [req.params.id, userId]);
    res.status(201).json(fmtMember(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/teams/:id/tenants — ids dos tenants atribuídos à equipe
router.get('/:id/tenants', auth, resolveScope, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT company_id FROM team_tenants WHERE team_id = ?', [req.params.id]);
    res.json({ tenantIds: rows.map((r) => r.company_id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/teams/:id/tenants  { tenantIds: [] } — define quais tenants a equipe enxerga.
// Só o operador Default (master/admin) atribui tenants — é um conceito da empresa Default:
// os membros da equipe passam a ver SOMENTE os dados desses tenants.
router.put('/:id/tenants', auth, resolveScope, requirePermission('teams_manage'), async (req, res) => {
  if (!req.scope.isMaster && !req.scope.isAdmin) {
    return res.status(403).json({ error: 'Apenas o operador Default pode atribuir tenants a equipes.' });
  }
  const teamId = req.params.id;
  const tenantIds = Array.isArray(req.body && req.body.tenantIds) ? req.body.tenantIds.filter(Boolean) : [];
  try {
    const [tr] = await db.query('SELECT id FROM teams WHERE id = ?', [teamId]);
    if (!tr.length) return res.status(404).json({ error: 'Equipe não encontrada' });
    // Valida que os tenants informados existem de fato.
    let valid = [];
    if (tenantIds.length) {
      const [cs] = await db.query(
        `SELECT id FROM companies WHERE id IN (${tenantIds.map(() => '?').join(',')})`, tenantIds);
      valid = cs.map((c) => c.id);
    }
    await db.query('DELETE FROM team_tenants WHERE team_id = ?', [teamId]);
    if (valid.length) {
      const values = valid.map(() => '(?,?)').join(',');
      const flat = valid.flatMap((cid) => [teamId, cid]);
      await db.query(`INSERT INTO team_tenants (team_id, company_id) VALUES ${values}`, flat);
    }
    res.json({ ok: true, tenantIds: valid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/teams/:id/members/:userId — altera o papel de um membro  { role }
router.patch('/:id/members/:userId', auth, requirePermission('teams_manage'), async (req, res) => {
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'role required' });
  try {
    await db.query(`UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?`,
      [role, req.params.id, req.params.userId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/teams/:id/members/:userId — remove um usuário da equipe
router.delete('/:id/members/:userId', auth, requirePermission('teams_manage'), async (req, res) => {
  try {
    await db.query(`DELETE FROM team_members WHERE team_id = ? AND user_id = ?`,
      [req.params.id, req.params.userId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
