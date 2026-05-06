const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { resolveScope, buildCompanyFilter } = require('../middleware/acl');

function fmtTeam(r) {
  return {
    id: r.id, name: r.name, description: r.description ?? null,
    color: r.color, memberCount: Number(r.member_count ?? 0),
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function fmtMember(r) {
  return {
    id: r.id, teamId: r.team_id, userId: r.user_id,
    userDisplayName: r.display_name ?? r.user_id,
    userEmail: r.email ?? '',
    role: r.role, joinedAt: r.joined_at,
  };
}

// GET /api/teams
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
    res.json(rows.map(fmtTeam));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/teams
router.post('/', auth, resolveScope, async (req, res) => {
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

// PATCH /api/teams/:id
router.patch('/:id', auth, resolveScope, async (req, res) => {
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

// DELETE /api/teams/:id
router.delete('/:id', auth, resolveScope, async (req, res) => {
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

// GET /api/teams/:id/members
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

// POST /api/teams/:id/members  { userId, role }
router.post('/:id/members', auth, resolveScope, async (req, res) => {
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

// PATCH /api/teams/:id/members/:userId  { role }
router.patch('/:id/members/:userId', auth, async (req, res) => {
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'role required' });
  try {
    await db.query(`UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?`,
      [role, req.params.id, req.params.userId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/teams/:id/members/:userId
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    await db.query(`DELETE FROM team_members WHERE team_id = ? AND user_id = ?`,
      [req.params.id, req.params.userId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
