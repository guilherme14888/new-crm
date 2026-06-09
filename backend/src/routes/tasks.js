const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope } = require('../middleware/acl');
const { v4: uuidv4 } = require('uuid');

/** Formata um registro de tarefa do banco para o objeto de API. */
function fmt(r) {
  return {
    id: r.id, dealId: r.deal_id, assignedTo: r.assigned_to ?? null,
    title: r.title, description: r.description ?? null, type: r.type,
    dueDate: r.due_date ?? null, completedAt: r.completed_at ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** Verifica se o escopo do usuário tem acesso ao deal (admin/master sempre; demais só da própria empresa). */
async function verifyDealAccess(scope, dealId) {
  if (scope.isAdmin || scope.isMaster) return true;
  const [rows] = await db.query('SELECT company_id FROM deals WHERE id = ?', [dealId]);
  return rows.length > 0 && rows[0].company_id === scope.companyId;
}

// GET /api/tasks?dealId= — lista as tarefas (não excluídas) de um deal, pendentes primeiro
router.get('/', auth, resolveScope, async (req, res) => {
  try {
    const { dealId } = req.query;
    if (!dealId) return res.status(400).json({ error: 'dealId required' });
    if (!await verifyDealAccess(req.scope, dealId))
      return res.status(403).json({ error: 'Acesso negado' });
    const [rows] = await db.query(
      `SELECT * FROM tasks WHERE deal_id = ? AND deleted_at IS NULL ORDER BY completed_at IS NOT NULL, due_date ASC, created_at DESC`,
      [dealId]
    );
    res.json(rows.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tasks — cria uma nova tarefa atrelada a um deal (requer dealId e title)
router.post('/', auth, resolveScope, async (req, res) => {
  const { dealId, title, type, dueDate, assignedTo, description } = req.body;
  if (!dealId || !title) return res.status(400).json({ error: 'dealId and title required' });
  if (!await verifyDealAccess(req.scope, dealId))
    return res.status(403).json({ error: 'Acesso negado' });
  const id = uuidv4();
  try {
    await db.query(
      `INSERT INTO tasks (id, deal_id, assigned_to, title, description, type, due_date) VALUES (?,?,?,?,?,?,?)`,
      [id, dealId, assignedTo ?? null, title, description ?? null, type ?? 'to_do', dueDate ?? null]
    );
    const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
    res.status(201).json(fmt(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/tasks/:id — atualiza campos parciais de uma tarefa (título, descrição, tipo, vencimento, responsável)
router.patch('/:id', auth, resolveScope, async (req, res) => {
  const map = { title: 'title', description: 'description', type: 'type', dueDate: 'due_date', assignedTo: 'assigned_to' };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (req.body[k] !== undefined) { sets.push(`${col} = ?`); vals.push(req.body[k]); }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

  if (!req.scope.isAdmin && !req.scope.isMaster) {
    const [rows] = await db.query(
      `SELECT d.company_id FROM tasks t JOIN deals d ON d.id = t.deal_id WHERE t.id = ?`,
      [req.params.id]
    );
    if (!rows.length || rows[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
  }

  vals.push(req.params.id);
  try {
    await db.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/tasks/:id/complete — marca a tarefa como concluída (define completed_at = agora)
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    await db.query(`UPDATE tasks SET completed_at = NOW() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/tasks/:id/reopen — reabre a tarefa concluída (limpa completed_at)
router.patch('/:id/reopen', auth, async (req, res) => {
  try {
    await db.query(`UPDATE tasks SET completed_at = NULL WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/tasks/:id — exclusão lógica da tarefa (define deleted_at = agora)
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query(`UPDATE tasks SET deleted_at = NOW() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
