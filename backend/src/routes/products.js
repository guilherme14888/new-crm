const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { resolveScope, buildCompanyFilter } = require('../middleware/acl');
const { v4: uuidv4 } = require('uuid');

/** Formata um registro de produto do catálogo para o objeto de API. */
function fmtProduct(r) {
  return {
    id: r.id, name: r.name, description: r.description ?? null,
    unitPrice: r.unit_price, currency: r.currency,
    isActive: !!r.is_active, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** Formata um item produto-do-deal (deal_products) para o objeto de API. */
function fmtDealProduct(r) {
  return {
    id: r.id, dealId: r.deal_id, productId: r.product_id,
    productName: r.product_name ?? null,
    quantity: parseFloat(r.quantity), unitPrice: r.unit_price,
    discount: parseFloat(r.discount), createdAt: r.created_at,
  };
}

// GET /api/products — lista os produtos ativos do catálogo da empresa do usuário
router.get('/', auth, resolveScope, async (req, res) => {
  try {
    const { where, params } = buildCompanyFilter(req.scope);
    const [rows] = await db.query(
      `SELECT * FROM products WHERE is_active = 1 AND ${where} ORDER BY name`,
      params
    );
    res.json(rows.map(fmtProduct));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/products — cria um produto no catálogo da empresa (requer name)
router.post('/', auth, resolveScope, async (req, res) => {
  const { name, description, unitPrice, currency = 'BRL' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = uuidv4();
  const companyId = req.scope.companyId;
  try {
    await db.query(
      `INSERT INTO products (id, company_id, name, description, unit_price, currency) VALUES (?,?,?,?,?,?)`,
      [id, companyId, name, description ?? null, unitPrice ?? 0, currency]
    );
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    res.status(201).json(fmtProduct(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/products/:id — atualiza campos parciais de um produto (valida acesso à empresa)
router.patch('/:id', auth, resolveScope, async (req, res) => {
  if (!req.scope.isAdmin && !req.scope.isMaster) {
    const [rows] = await db.query('SELECT company_id FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length || rows[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
  }
  const map = { name: 'name', description: 'description', unitPrice: 'unit_price', currency: 'currency', isActive: 'is_active' };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (req.body[k] !== undefined) { sets.push(`${col} = ?`); vals.push(req.body[k]); }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.params.id);
  try {
    await db.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/products/:id — desativa o produto (is_active = 0), exclusão lógica
router.delete('/:id', auth, resolveScope, async (req, res) => {
  if (!req.scope.isAdmin && !req.scope.isMaster) {
    const [rows] = await db.query('SELECT company_id FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length || rows[0].company_id !== req.scope.companyId)
      return res.status(403).json({ error: 'Acesso negado' });
  }
  try {
    await db.query(`UPDATE products SET is_active = 0 WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/products/deal/:dealId — lista os produtos vinculados a um deal (com nome do produto)
router.get('/deal/:dealId', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT dp.*, p.name AS product_name FROM deal_products dp
       JOIN products p ON p.id = dp.product_id
       WHERE dp.deal_id = ? ORDER BY dp.created_at`,
      [req.params.dealId]
    );
    res.json(rows.map(fmtDealProduct));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/products/deal/:dealId — vincula um produto ao deal (usa preço do catálogo se unitPrice não informado)
router.post('/deal/:dealId', auth, async (req, res) => {
  const { productId, quantity = 1, unitPrice, discount = 0 } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId required' });
  const id = uuidv4();
  try {
    let price = unitPrice;
    if (price === undefined) {
      const [pRows] = await db.query('SELECT unit_price FROM products WHERE id = ?', [productId]);
      price = pRows[0]?.unit_price ?? 0;
    }
    await db.query(
      `INSERT INTO deal_products (id, deal_id, product_id, quantity, unit_price, discount) VALUES (?,?,?,?,?,?)`,
      [id, req.params.dealId, productId, quantity, price, discount]
    );
    const [rows] = await db.query(
      `SELECT dp.*, p.name AS product_name FROM deal_products dp
       JOIN products p ON p.id = dp.product_id WHERE dp.id = ?`,
      [id]
    );
    res.status(201).json(fmtDealProduct(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/products/deal/:dealId/:id — remove (hard delete) um produto vinculado ao deal
router.delete('/deal/:dealId/:id', auth, async (req, res) => {
  try {
    await db.query(`DELETE FROM deal_products WHERE id = ? AND deal_id = ?`, [req.params.id, req.params.dealId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
