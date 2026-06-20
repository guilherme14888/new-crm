// Segredos de integrações GLOBAIS (cifrados em repouso), cadastráveis pela UI e
// lidos por qualquer serviço (API, scrape-worker). Reusa a cripto do aiConfig
// (mesmo segredo AI_KEY_SECRET||JWT_SECRET).

const db = require('../db');
const { encryptSecret, decryptSecret } = require('./aiConfig');

/** Grava (ou limpa, se value vazio) um segredo de integração. */
async function setSecret(name, value) {
  const v = value == null ? '' : String(value).trim();
  const enc = v ? encryptSecret(v) : null;
  await db.query(
    'INSERT INTO app_integrations (name, value_enc) VALUES (?,?) ON DUPLICATE KEY UPDATE value_enc = VALUES(value_enc)',
    [name, enc]
  );
}

/** Lê o segredo em claro (ou null). */
async function getSecret(name) {
  try {
    const [r] = await db.query('SELECT value_enc FROM app_integrations WHERE name = ? LIMIT 1', [name]);
    return r[0] && r[0].value_enc ? decryptSecret(r[0].value_enc) : null;
  } catch { return null; }
}

async function hasSecret(name) { return !!(await getSecret(name)); }

module.exports = { setSecret, getSecret, hasSecret };
