const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { requireMasterPermission } = require('../middleware/acl');
const { v4: uuidv4 } = require('uuid');

/** Serializa uma linha de empresa para o formato JSON da API, incluindo IDs de produtos vinculados. */
function fmt(r, productIds = []) {
  return {
    id: r.id, name: r.name, slug: r.slug,
    plan: r.plan, cnpj: r.cnpj ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
    porteId: r.porte_id ?? null,
    fornecimentoId: r.fornecimento_id ?? null,
    eixoId: r.eixo_id ?? null,
    segmentoId: r.segmento_id ?? null,
    produtoIds: productIds,
    isActive: !!r.is_active,
    userCount: Number(r.user_count ?? 0),
    createdAt: r.created_at,
  };
}

/** Retorna a lista de IDs de produtos vinculados a uma empresa. */
async function loadProductsFor(companyId) {
  const [rows] = await db.query(
    'SELECT produto_id FROM company_produto_links WHERE company_id = ?',
    [companyId]
  );
  return rows.map((r) => r.produto_id);
}

/** Sincroniza os vínculos empresa-produto, substituindo os existentes pela lista informada. */
async function syncProductLinks(companyId, produtoIds) {
  if (!Array.isArray(produtoIds)) return;
  await db.query('DELETE FROM company_produto_links WHERE company_id = ?', [companyId]);
  if (produtoIds.length === 0) return;
  const values = produtoIds.map((pid) => [companyId, pid]);
  await db.query(
    'INSERT INTO company_produto_links (company_id, produto_id) VALUES ?',
    [values]
  );
}

/**
 * Seed a "Pipeline Principal" funnel with 5 stages for a brand-new company.
 * Called right after company INSERT so every tenant starts with a working pipeline.
 */
async function seedDefaultPipeline(companyId) {
  const funnelId = uuidv4();
  await db.query(
    `INSERT INTO funnels (id, company_id, name, is_default) VALUES (?, ?, 'Pipeline Principal', 1)`,
    [funnelId, companyId]
  );
  const stages = [
    { name: 'Qualificação', order: 0, color: '#94a3b8', probability: 10,  type: 'active' },
    { name: 'Proposta',     order: 1, color: '#3b82f6', probability: 40,  type: 'active' },
    { name: 'Negociação',   order: 2, color: '#f59e0b', probability: 70,  type: 'active' },
    { name: 'Ganho',        order: 3, color: '#16a34a', probability: 100, type: 'won'    },
    { name: 'Perdido',      order: 4, color: '#ef4444', probability: 0,   type: 'lost'   },
  ];
  for (const s of stages) {
    await db.query(
      `INSERT INTO funnel_stages (id, funnel_id, company_id, name, order_index, color, probability, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), funnelId, companyId, s.name, s.order, s.color, s.probability, s.type]
    );
  }
}

// GET /api/companies — lista todas as empresas com contagem de usuários e produtos vinculados (admin)
router.get('/', auth, requireMasterPermission('companies_manage'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, COUNT(u.id) AS user_count
       FROM companies c
       LEFT JOIN users u ON u.company_id = c.id AND u.is_active = 1
       GROUP BY c.id
       ORDER BY c.name`
    );
    const ids = rows.map((r) => r.id);
    let linksByCompany = {};
    if (ids.length) {
      const [links] = await db.query(
        'SELECT company_id, produto_id FROM company_produto_links WHERE company_id IN (?)',
        [ids]
      );
      for (const l of links) {
        (linksByCompany[l.company_id] ??= []).push(l.produto_id);
      }
    }
    res.json(rows.map((r) => fmt(r, linksByCompany[r.id] ?? [])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/companies — cria uma empresa, vincula produtos e popula o pipeline padrão (admin)
router.post('/', auth, requireMasterPermission('companies_manage'), async (req, res) => {
  const {
    name, slug, plan = 'starter', cnpj,
    city, state, porteId, fornecimentoId, eixoId, segmentoId, produtoIds,
  } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name e slug são obrigatórios' });
  const id = uuidv4();
  try {
    await db.query(
      `INSERT INTO companies (id, name, slug, plan, cnpj, city, state, porte_id, fornecimento_id, eixo_id, segmento_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, name, slug.toLowerCase().replace(/\s+/g, '-'), plan, cnpj ?? null,
        city ?? null, state ?? null,
        porteId ?? null, fornecimentoId ?? null, eixoId ?? null, segmentoId ?? null,
      ]
    );
    await syncProductLinks(id, produtoIds);
    // Seed default pipeline so the new tenant is immediately usable
    await seedDefaultPipeline(id);

    const [rows] = await db.query(
      `SELECT c.*, 0 AS user_count FROM companies c WHERE c.id = ?`, [id]
    );
    res.status(201).json(fmt(rows[0], await loadProductsFor(id)));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Slug já existe' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/companies/:id — atualiza campos da empresa e ressincroniza produtos vinculados (admin)
router.patch('/:id', auth, requireMasterPermission('companies_manage'), async (req, res) => {
  const {
    name, slug, plan, cnpj, isActive,
    city, state, porteId, fornecimentoId, eixoId, segmentoId, produtoIds,
  } = req.body;
  const sets = [], vals = [];
  if (name !== undefined)            { sets.push('name = ?');             vals.push(name); }
  if (slug !== undefined)            { sets.push('slug = ?');             vals.push(slug.toLowerCase().replace(/\s+/g, '-')); }
  if (plan !== undefined)            { sets.push('plan = ?');             vals.push(plan); }
  if (cnpj !== undefined)            { sets.push('cnpj = ?');             vals.push(cnpj ?? null); }
  if (isActive !== undefined)        { sets.push('is_active = ?');        vals.push(isActive ? 1 : 0); }
  if (city !== undefined)            { sets.push('city = ?');             vals.push(city ?? null); }
  if (state !== undefined)           { sets.push('state = ?');            vals.push(state ?? null); }
  if (porteId !== undefined)         { sets.push('porte_id = ?');         vals.push(porteId ?? null); }
  if (fornecimentoId !== undefined)  { sets.push('fornecimento_id = ?');  vals.push(fornecimentoId ?? null); }
  if (eixoId !== undefined)          { sets.push('eixo_id = ?');          vals.push(eixoId ?? null); }
  if (segmentoId !== undefined)      { sets.push('segmento_id = ?');      vals.push(segmentoId ?? null); }

  try {
    if (sets.length) {
      vals.push(req.params.id);
      await db.query(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`, vals);
    }
    if (produtoIds !== undefined) await syncProductLinks(req.params.id, produtoIds);
    const [rows] = await db.query(
      `SELECT c.*, COUNT(u.id) AS user_count FROM companies c
       LEFT JOIN users u ON u.company_id = c.id AND u.is_active = 1
       WHERE c.id = ? GROUP BY c.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Empresa não encontrada' });
    res.json(fmt(rows[0], await loadProductsFor(req.params.id)));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Slug já existe' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/companies/:id — exclui a empresa (se sem usuários ativos) em cascata com funis e motivos (admin)
router.delete('/:id', auth, requireMasterPermission('companies_manage'), async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT COUNT(*) AS c FROM users WHERE company_id = ? AND is_active = 1', [req.params.id]
    );
    if (users[0].c > 0)
      return res.status(409).json({ error: `Não é possível excluir: ${users[0].c} usuário(s) ativo(s) nesta empresa` });
    // Cascade: remove funnels, stages, win/loss reasons scoped to this company
    await db.query('DELETE FROM company_produto_links WHERE company_id = ?', [req.params.id]);
    await db.query('DELETE fs FROM funnel_stages fs JOIN funnels f ON f.id = fs.funnel_id WHERE f.company_id = ?', [req.params.id]);
    await db.query('DELETE FROM funnels WHERE company_id = ?', [req.params.id]);
    await db.query('DELETE FROM win_loss_reasons WHERE company_id = ?', [req.params.id]);
    await db.query('DELETE FROM companies WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
