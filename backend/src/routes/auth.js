const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const authMw  = require('../middleware/auth');
const { requireAdmin } = require('../middleware/acl');
const { audit } = require('../services/auditLog');
const finance = require('./finance');

const COMPANY_BLOCKED_MSG = 'Existe uma cobrança em aberto, entre em contato com nosso setor financeiro para resolver.';

function makeToken(user, activeCompanyId) {
  return jwt.sign(
    {
      id:         user.id,
      email:      user.email,
      role:       user.role,
      company_id: activeCompanyId ?? user.company_id,
      team_id:    user.team_id ?? null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function safeUser(u, activeCompanyId, companyName = null) {
  return {
    id:          u.id,
    email:       u.email,
    displayName: u.display_name,
    avatarUrl:   u.avatar_url,
    role:        u.role,
    companyId:   activeCompanyId ?? u.company_id,
    companyName: companyName ?? u.company_name ?? null,
    teamId:      u.team_id ?? null,
  };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  try {
    const [rows] = await db.query(
      `SELECT u.*, c.name AS company_name
       FROM users u LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.email = ? AND u.is_active = 1 LIMIT 1`, [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Credenciais inválidas' });

    // Reconcilia o status de bloqueio (caso uma fatura tenha vencido) e
    // recarrega o registro da empresa.
    if (user.company_id) {
      try { await finance.reconcileBlock(user.company_id); } catch { /* ignore */ }
      const [crows] = await db.query('SELECT id, is_blocked, blocked_reason FROM companies WHERE id = ?', [user.company_id]);
      const company = crows[0];
      if (company && company.is_blocked && user.role !== 'admin') {
        return res.status(403).json({
          error: COMPANY_BLOCKED_MSG,
          code: 'company_blocked',
          reason: company.blocked_reason ?? null,
        });
      }
    }

    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = makeToken(user, user.company_id);
    audit(req, { action: 'login', resource: 'users', resourceId: user.id });
    res.json({ token, user: safeUser(user, user.company_id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me
router.get('/me', authMw, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.*, c.name AS company_name
       FROM users u LEFT JOIN companies c ON c.id = ?
       WHERE u.id = ? LIMIT 1`,
      [req.user.company_id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(safeUser(rows[0], req.user.company_id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/switch-company  { companyId }
router.post('/switch-company', authMw, async (req, res) => {
  const { companyId } = req.body;
  if (!companyId) return res.status(400).json({ error: 'companyId obrigatório' });
  try {
    const [companies] = await db.query('SELECT * FROM companies WHERE id = ? AND is_active = 1', [companyId]);
    if (!companies[0]) return res.status(404).json({ error: 'Empresa não encontrada' });

    // Admin can switch to any; others must have membership in user_companies
    if (req.user.role !== 'admin') {
      const [mem] = await db.query(
        'SELECT 1 FROM user_companies WHERE user_id = ? AND company_id = ?',
        [req.user.id, companyId]
      );
      if (!mem.length) return res.status(403).json({ error: 'Sem acesso a esta empresa' });
    }

    const [userRows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const token = makeToken(userRows[0], companyId);
    audit(req, { action: 'switch_company', resource: 'companies', resourceId: companyId });
    res.json({
      token,
      activeCompanyId: companyId,
      company: { id: companies[0].id, name: companies[0].name },
      user: safeUser(userRows[0], companyId, companies[0].name),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/companies  — admin sees all; others see their assigned companies
router.get('/companies', authMw, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      [rows] = await db.query(
        'SELECT id, name, slug, plan, is_active, created_at FROM companies WHERE is_active = 1 ORDER BY name'
      );
    } else {
      [rows] = await db.query(
        `SELECT c.id, c.name, c.slug, c.plan, c.is_active, c.created_at
         FROM companies c
         INNER JOIN user_companies uc ON uc.company_id = c.id
         WHERE uc.user_id = ? AND c.is_active = 1 ORDER BY c.name`,
        [req.user.id]
      );
    }
    res.json(rows.map((r) => ({
      id: r.id, name: r.name, slug: r.slug,
      plan: r.plan, isActive: !!r.is_active, createdAt: r.created_at,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/auth/me  — update own profile (displayName, avatarUrl, password)
router.patch('/me', authMw, async (req, res) => {
  const { displayName, avatarUrl, password, currentPassword } = req.body;
  const sets = [], vals = [];
  if (displayName !== undefined) { sets.push('display_name = ?'); vals.push(displayName.trim()); }
  if (avatarUrl  !== undefined) { sets.push('avatar_url = ?');   vals.push(avatarUrl ?? null); }
  if (password) {
    if (!currentPassword) return res.status(400).json({ error: 'Senha atual é obrigatória para alterá-la' });
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Senha atual incorreta' });
    const hash = await bcrypt.hash(password, 10);
    sets.push('password_hash = ?'); vals.push(hash);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  vals.push(req.user.id);
  try {
    await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json(safeUser(rows[0], req.user.company_id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/change-password
router.post('/change-password', authMw, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Campos obrigatórios' });
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash)))
      return res.status(401).json({ error: 'Senha atual incorreta' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    audit(req, { action: 'update', resource: 'users', resourceId: user.id, newValue: { passwordChanged: true } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
