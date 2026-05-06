/**
 * CRUD routes for the company classification catalogs:
 *   - portes
 *   - fornecimentos
 *   - eixos
 *   - segmentos
 *   - produtos
 *
 * All five share the same shape (id, name) so we generate the routes
 * from a small table to avoid five copy-pasted files.
 */
const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { requireAdmin } = require('../middleware/acl');
const { v4: uuidv4 } = require('uuid');

// Whitelist: caller path → physical table name
const TABLES = {
  portes:         'company_portes',
  fornecimentos:  'company_fornecimentos',
  eixos:          'company_eixos',
  segmentos:      'company_segmentos',
  produtos:       'company_produtos',
};

function fmt(r) {
  return { id: r.id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at };
}

function makeHandlers(table) {
  return {
    list: async (_req, res) => {
      try {
        const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY name`);
        res.json(rows.map(fmt));
      } catch (e) { res.status(500).json({ error: e.message }); }
    },
    create: async (req, res) => {
      const { name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'name é obrigatório' });
      const id = uuidv4();
      try {
        await db.query(`INSERT INTO ${table} (id, name) VALUES (?, ?)`, [id, name.trim()]);
        const [rows] = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
        res.status(201).json(fmt(rows[0]));
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Nome já existe' });
        res.status(500).json({ error: e.message });
      }
    },
    update: async (req, res) => {
      const { name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'name é obrigatório' });
      try {
        await db.query(`UPDATE ${table} SET name = ? WHERE id = ?`, [name.trim(), req.params.id]);
        const [rows] = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
        res.json(fmt(rows[0]));
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Nome já existe' });
        res.status(500).json({ error: e.message });
      }
    },
    delete: async (req, res) => {
      try {
        await db.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
        res.json({ ok: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    },
  };
}

for (const [path, table] of Object.entries(TABLES)) {
  const h = makeHandlers(table);
  router.get(`/${path}`,        auth, requireAdmin, h.list);
  router.post(`/${path}`,       auth, requireAdmin, h.create);
  router.patch(`/${path}/:id`,  auth, requireAdmin, h.update);
  router.delete(`/${path}/:id`, auth, requireAdmin, h.delete);
}

module.exports = router;
