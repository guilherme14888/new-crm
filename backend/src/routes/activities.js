const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope } = require('../middleware/acl');
const { v4: uuidv4 } = require('uuid');

/**
 * Converte Date JavaScript para formato DATETIME do MySQL (YYYY-MM-DD HH:MM:SS).
 * @param date Objeto Date
 * @returns String formato MySQL
 */
function toMySQLDatetime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Converte datetime do MySQL para ISO 8601 (com Z para UTC).
 * MySQL DATETIME não armazena info de timezone, é sempre UTC.
 * @param val String ou Date do MySQL
 * @returns String ISO 8601 (ex: "2025-04-09T10:30:00Z")
 */
function toISO(val) {
  if (!val) return null;
  // MySQL DATETIME não tem info de timezone — armazenado como UTC, então apenda Z
  return val.toString().replace(' ', 'T') + 'Z';
}

/**
 * Formata um registro de atividade do banco para o objeto de API.
 * @param r Linha da tabela activities
 * @returns Objeto Activity formatado para resposta JSON
 */
function fmt(r) {
  return {
    id: r.id, dealId: r.deal_id ?? null, contactId: r.contact_id,
    type: r.type, title: r.title, description: r.description ?? null,
    occurredAt: toISO(r.occurred_at), metadata: r.metadata ?? null,
    createdAt: toISO(r.created_at), syncStatus: 'synced',
  };
}

/**
 * GET /api/activities?dealId=&contactId=
 * Lista atividades filtradas por deal e/ou contato.
 * Respeta escopo de acesso — admin vê tudo, outros veem apenas da sua empresa.
 */
router.get('/', auth, resolveScope, async (req, res) => {
  try {
    const { dealId, contactId } = req.query;
    const { scope } = req;

    // Join com contacts para enforçar isolamento no nível de empresa
    let sql = `SELECT a.* FROM activities a
               JOIN contacts c ON c.id = a.contact_id
               WHERE c.deleted_at IS NULL`;
    const params = [];

    if (!scope.isAdmin) {
      sql += ' AND c.company_id = ?';
      params.push(scope.companyId);
    }

    if (dealId)    { sql += ' AND a.deal_id = ?';    params.push(dealId); }
    if (contactId) { sql += ' AND a.contact_id = ?'; params.push(contactId); }
    sql += ' ORDER BY a.occurred_at DESC LIMIT 100';

    const [rows] = await db.query(sql, params);
    res.json(rows.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/activities
 * Cria uma nova atividade (call, email, meeting, note) atrelada a um contato.
 * Requer: contactId, type, title
 * Opcional: dealId, description, occurredAt, metadata
 */
router.post('/', auth, resolveScope, async (req, res) => {
  const { dealId, contactId, type, title, description, occurredAt, metadata } = req.body;
  if (!contactId || !type || !title) return res.status(400).json({ error: 'contactId, type, title required' });

  // Verifica que o contato pertence a esta empresa (exceto para admin)
  if (!req.scope.isAdmin && !req.scope.isMaster) {
    const [cRows] = await db.query('SELECT company_id FROM contacts WHERE id = ?', [contactId]);
    if (!cRows.length || cRows[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
  }

  const id = uuidv4();
  try {
    await db.query(
      `INSERT INTO activities (id, deal_id, contact_id, type, title, description, occurred_at, metadata) VALUES (?,?,?,?,?,?,?,?)`,
      [id, dealId ?? null, contactId, type, title, description ?? null,
       toMySQLDatetime(occurredAt ? new Date(occurredAt) : new Date()), metadata ? JSON.stringify(metadata) : null]
    );
    const [rows] = await db.query('SELECT * FROM activities WHERE id = ?', [id]);
    res.status(201).json(fmt(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
