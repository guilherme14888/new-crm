const jwt = require('jsonwebtoken');
const db  = require('../db');

// Cache de revogação: userId -> { active, exp }. Evita 1 query por request
// (mantém a escala) e ainda corta usuários desativados em até ~60s.
const REVOKE_TTL_MS = 60 * 1000;
const revokeCache = new Map();

/**
 * Middleware de autenticação JWT.
 * Valida o token Bearer no header Authorization e atribui req.user com o payload.
 * Além de verificar a assinatura, confere se o usuário ainda está ativo (revogação
 * quase em tempo real), com cache curto para não bater no banco a cada request.
 */
module.exports = async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  // Revogação: usuário desativado/excluído perde acesso mesmo com token válido.
  try {
    const now = Date.now();
    const hit = revokeCache.get(payload.id);
    let active;
    if (hit && hit.exp > now) {
      active = hit.active;
    } else {
      const [rows] = await db.query('SELECT is_active FROM users WHERE id = ? LIMIT 1', [payload.id]);
      active = !!(rows[0] && rows[0].is_active);
      if (revokeCache.size > 5000) revokeCache.clear(); // evita crescimento sem limite
      revokeCache.set(payload.id, { active, exp: now + REVOKE_TTL_MS });
    }
    if (!active) return res.status(401).json({ error: 'Sessão encerrada. Faça login novamente.' });
  } catch {
    // Falha de infra no check secundário não derruba o login (fail-open só aqui).
  }

  req.user = payload;
  next();
};
