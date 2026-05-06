const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticação JWT.
 * Valida o token Bearer no header Authorization e atribui req.user com o payload decodificado.
 * Se inválido ou expirado, retorna 401.
 */
module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};
