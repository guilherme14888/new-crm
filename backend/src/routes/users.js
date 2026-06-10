const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const db      = require('../db');
const auth    = require('../middleware/auth');
const { resolveScope, requireRole, buildCompanyFilter, canAssignRole } = require('../middleware/acl');
const { audit } = require('../services/auditLog');

/** Serializa uma linha de usuário do banco para o formato JSON exposto na API. */
function fmt(row) {
  if (!row) return null;
  return {
    id: row.id, email: row.email,
    displayName: row.display_name, avatarUrl: row.avatar_url,
    role: row.role, aclProfileId: row.acl_profile_id ?? null,
    isActive: !!row.is_active,
    companyId: row.company_id, teamId: row.team_id ?? null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// GET /api/users — scoped by role
router.get('/', auth, resolveScope, async (req, res) => {
  const { scope } = req;
  try {
    let query, params;
    if (scope.isAdmin) {
      // Admin can request all users across all companies (for user-assignment UI)
      if (req.query.allCompanies) {
        const [rows] = await db.query(
          `SELECT u.*, c.name AS company_name,
                  GROUP_CONCAT(uc.company_id ORDER BY uc.created_at SEPARATOR ',') AS company_ids
           FROM users u
           LEFT JOIN companies c ON c.id = u.company_id
           LEFT JOIN user_companies uc ON uc.user_id = u.id
           WHERE u.is_active = 1
           GROUP BY u.id
           ORDER BY u.display_name`
        );
        return res.json(rows.map(r => ({
          ...fmt(r),
          companyName: r.company_name ?? null,
          companyIds: r.company_ids ? r.company_ids.split(',') : [],
        })));
      }
      // Admin sees all users of active company (or all if no company context)
      if (scope.companyId) {
        query  = `SELECT * FROM users WHERE company_id = ? AND is_active = 1 ORDER BY display_name`;
        params = [scope.companyId];
      } else {
        query  = `SELECT * FROM users WHERE is_active = 1 ORDER BY display_name`;
        params = [];
      }
    } else if (scope.role === 'manager') {
      query  = `SELECT * FROM users WHERE company_id = ? AND is_active = 1 ORDER BY display_name`;
      params = [scope.companyId];
    } else if (scope.role === 'supervisor') {
      // Supervisor sees users in their team
      query  = `SELECT u.* FROM users u
                INNER JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
                WHERE u.company_id = ? AND u.is_active = 1 ORDER BY u.display_name`;
      params = [scope.teamId, scope.companyId];
    } else {
      // Consultant: only themselves
      query  = `SELECT * FROM users WHERE id = ? AND company_id = ?`;
      params = [scope.userId, scope.companyId];
    }
    const [rows] = await db.query(query, params);
    res.json(rows.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/:id — retorna um usuário, respeitando o escopo de acesso do solicitante
router.get('/:id', auth, resolveScope, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });
    const u = rows[0];
    // Consultants can only see themselves
    if (scope.role === 'consultant' && u.id !== req.scope.userId)
      return res.status(403).json({ error: 'Acesso negado' });
    // All others must be same company
    if (!req.scope.isAdmin && !req.scope.isMaster && u.company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
    res.json(fmt(u));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users — manager+ can create users in their company; admin in any
router.post('/', auth, resolveScope, requireRole('admin', 'manager'), async (req, res) => {
  const { id, email, password, displayName, avatarUrl, role, teamId } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

  // Prevent privilege escalation
  if (!canAssignRole(req.scope.role, role ?? 'consultant'))
    return res.status(403).json({ error: 'Não é possível criar usuário com papel superior ao seu' });

  // Non-admins can only create users in their own company
  const targetCompanyId = req.scope.isAdmin ? (req.body.companyId ?? req.scope.companyId) : req.scope.companyId;

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO users (id, company_id, team_id, email, password_hash, display_name, avatar_url, role, acl_profile_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, targetCompanyId, teamId ?? null, email, hash, displayName ?? email, avatarUrl ?? null, role ?? 'consultant', req.body.aclProfileId ?? null]
    );
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    audit(req, { action: 'create', resource: 'users', resourceId: id, newValue: { email, role } });
    res.status(201).json(fmt(rows[0]));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email já cadastrado' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/:id — atualiza um usuário com validações de escopo e bloqueio de escalonamento de papel
router.patch('/:id', auth, resolveScope, async (req, res) => {
  const { scope } = req;
  const isSelf = scope.userId === req.params.id;

  // Consultants can only edit themselves (and not change role/company)
  if (scope.role === 'consultant' && !isSelf)
    return res.status(403).json({ error: 'Acesso negado' });
  // Supervisors: only self or team members
  if (scope.role === 'supervisor' && !isSelf) {
    const [tm] = await db.query(
      'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?',
      [scope.teamId, req.params.id]
    );
    if (!tm.length) return res.status(403).json({ error: 'Acesso negado' });
  }
  // Managers can only edit users of their company
  if (scope.role === 'manager') {
    const [urows] = await db.query('SELECT company_id FROM users WHERE id = ?', [req.params.id]);
    if (!urows.length || (!scope.isMaster && urows[0].company_id !== scope.companyId))
      return res.status(403).json({ error: 'Acesso negado' });
  }

  // Only managers+ can change role; prevent privilege escalation
  if (req.body.role !== undefined) {
    if (!['admin', 'manager'].includes(scope.role))
      return res.status(403).json({ error: 'Sem permissão para alterar papel' });
    if (!canAssignRole(scope.role, req.body.role))
      return res.status(403).json({ error: 'Não é possível atribuir papel superior ao seu' });
  }

  // Only admin can move users between companies
  if (req.body.companyId !== undefined && !scope.isAdmin)
    return res.status(403).json({ error: 'Sem permissão para alterar empresa' });

  // Redefinição de senha: a própria senha (qualquer papel) ou, para admin/gerente,
  // a de outros usuários. Bloqueia redefinir a senha de quem tem papel superior.
  let passwordHash = null;
  if (req.body.password !== undefined && req.body.password !== '') {
    if (!isSelf && !['admin', 'manager'].includes(scope.role))
      return res.status(403).json({ error: 'Sem permissão para alterar a senha' });
    if (String(req.body.password).length < 8)
      return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
    if (!isSelf) {
      const [tr] = await db.query('SELECT role FROM users WHERE id = ?', [req.params.id]);
      if (tr.length && !canAssignRole(scope.role, tr[0].role))
        return res.status(403).json({ error: 'Não é possível redefinir a senha de um usuário com papel superior' });
    }
    passwordHash = await bcrypt.hash(String(req.body.password), 10);
  }

  const map = { displayName: 'display_name', avatarUrl: 'avatar_url', role: 'role', aclProfileId: 'acl_profile_id', isActive: 'is_active', teamId: 'team_id', companyId: 'company_id' };
  const sets = [], vals = [];
  for (const [jsKey, col] of Object.entries(map)) {
    if (req.body[jsKey] !== undefined) {
      sets.push(`${col} = ?`);
      vals.push(jsKey === 'isActive' ? (req.body[jsKey] ? 1 : 0) : req.body[jsKey]);
    }
  }
  if (passwordHash) { sets.push('password_hash = ?'); vals.push(passwordHash); }
  if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  vals.push(req.params.id);
  try {
    await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
    // nunca registrar a senha em claro no log de auditoria
    const safeBody = { ...req.body }; if (safeBody.password) safeBody.password = '[REDACTED]';
    audit(req, { action: 'update', resource: 'users', resourceId: req.params.id, newValue: safeBody });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:id — soft deactivate, manager+
router.delete('/:id', auth, resolveScope, requireRole('admin', 'manager'), async (req, res) => {
  const { scope } = req;
  // Managers can only deactivate users in their company
  if (scope.role === 'manager') {
    const [rows] = await db.query('SELECT company_id FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length || (!scope.isMaster && rows[0].company_id !== scope.companyId))
      return res.status(403).json({ error: 'Acesso negado' });
  }
  try {
    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    audit(req, { action: 'delete', resource: 'users', resourceId: req.params.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/:id/companies — add user to a company (admin only)
router.post('/:id/companies', auth, resolveScope, requireRole('admin'), async (req, res) => {
  const { companyId } = req.body;
  if (!companyId) return res.status(400).json({ error: 'companyId obrigatório' });
  try {
    await db.query(
      'INSERT IGNORE INTO user_companies (user_id, company_id) VALUES (?, ?)',
      [req.params.id, companyId]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:id/companies/:companyId — remove user from a company (admin only)
router.delete('/:id/companies/:companyId', auth, resolveScope, requireRole('admin'), async (req, res) => {
  try {
    await db.query(
      'DELETE FROM user_companies WHERE user_id = ? AND company_id = ?',
      [req.params.id, req.params.companyId]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
