/**
 * Painel financeiro (admin only).
 *
 * Modelo de cobrança:
 *   - Cada empresa tem `billing_day` (1-31) e `block_grace_days` (default 4).
 *   - Licença = usuário ativo. `purchased_licenses` é o limite contratado.
 *   - Faturas mensais ficam em `company_invoices`. Quando uma fatura
 *     fica vencida + grace_days, a empresa é bloqueada automaticamente.
 *   - Receber o pagamento (manual ou via webhook do gateway) marca a
 *     fatura como `paid` e desbloqueia se a única razão do bloqueio for
 *     a fatura em atraso.
 *
 * Toda alteração relevante exige admin (requireAdmin).
 */
const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { requireAdmin } = require('../middleware/acl');
const { v4: uuidv4 } = require('uuid');

const MASTER_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converte uma linha da tabela `companies` no formato JSON (camelCase) usado na API financeira. */
function fmtCompany(r) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    plan: r.plan,
    cnpj: r.cnpj ?? null,
    isActive: !!r.is_active,
    isBlocked: !!r.is_blocked,
    blockedAt: r.blocked_at ?? null,
    blockedReason: r.blocked_reason ?? null,
    billingDay: r.billing_day ?? 5,
    blockGraceDays: r.block_grace_days ?? 4,
    licensePriceCents: Number(r.license_price_cents ?? 0),
    purchasedLicenses: Number(r.purchased_licenses ?? 0),
    activeLicenses: Number(r.active_licenses ?? 0),
    paymentProvider: r.payment_provider ?? null,
    paymentProviderRef: r.payment_provider_ref ?? null,
  };
}

/** Converte uma linha de `company_invoices` no formato JSON (camelCase) da fatura para a API. */
function fmtInvoice(r) {
  return {
    id: r.id,
    companyId: r.company_id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    dueDate: r.due_date,
    licensesBilled: Number(r.licenses_billed),
    unitPriceCents: Number(r.unit_price_cents),
    totalCents: Number(r.total_cents),
    status: r.status,
    paidAt: r.paid_at ?? null,
    paymentMethod: r.payment_method ?? null,
    paymentProvider: r.payment_provider ?? null,
    paymentProviderRef: r.payment_provider_ref ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Converte uma linha de `company_license_purchases` no formato JSON (camelCase) da compra de licenças. */
function fmtLicensePurchase(r) {
  return {
    id: r.id,
    companyId: r.company_id,
    quantity: Number(r.quantity),
    unitPriceCents: Number(r.unit_price_cents),
    totalCents: Number(r.total_cents),
    status: r.status,
    paidAt: r.paid_at ?? null,
    paymentProvider: r.payment_provider ?? null,
    paymentProviderRef: r.payment_provider_ref ?? null,
    createdAt: r.created_at,
  };
}

/**
 * Reconcilia o status de bloqueio de uma empresa baseado nas faturas:
 *   - Se há fatura `open` cujo `due_date + grace_days` já passou → bloqueia.
 *   - Se a empresa está bloqueada com motivo `overdue` mas não há fatura
 *     em atraso → desbloqueia.
 *   - Bloqueios manuais (`blocked_reason = 'manual'`) só são removidos
 *     via endpoint de unblock.
 */
async function reconcileBlock(companyId) {
  const [crows] = await db.query('SELECT * FROM companies WHERE id = ?', [companyId]);
  if (!crows.length) return;
  const c = crows[0];
  const grace = Number(c.block_grace_days ?? 4);

  // Marca como `overdue` qualquer fatura aberta cujo vencimento já passou
  await db.query(
    `UPDATE company_invoices
       SET status = 'overdue'
     WHERE company_id = ? AND status = 'open' AND due_date < CURDATE()`,
    [companyId]
  );

  // Há fatura realmente vencida (due + grace_days <= hoje) e não paga?
  const [overdueRows] = await db.query(
    `SELECT COUNT(*) AS c FROM company_invoices
      WHERE company_id = ?
        AND status IN ('open','overdue')
        AND DATE_ADD(due_date, INTERVAL ? DAY) <= CURDATE()`,
    [companyId, grace]
  );
  const hasOverdue = overdueRows[0].c > 0;

  if (hasOverdue && !c.is_blocked) {
    await db.query(
      `UPDATE companies SET is_blocked = 1, blocked_at = NOW(), blocked_reason = 'overdue' WHERE id = ?`,
      [companyId]
    );
  } else if (!hasOverdue && c.is_blocked && c.blocked_reason === 'overdue') {
    await db.query(
      `UPDATE companies SET is_blocked = 0, blocked_at = NULL, blocked_reason = NULL WHERE id = ?`,
      [companyId]
    );
  }
}

async function reconcileAll() {
  const [rows] = await db.query(
    `SELECT id FROM companies WHERE id != ? AND is_active = 1`,
    [MASTER_COMPANY_ID]
  );
  for (const r of rows) await reconcileBlock(r.id);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/admin/finance/companies
// Lista todas as empresas (exceto master/default) com info de cobrança
router.get('/companies', auth, requireAdmin, async (_req, res) => {
  try {
    await reconcileAll();
    const [rows] = await db.query(
      `SELECT c.*, COALESCE(u.active_count, 0) AS active_licenses
         FROM companies c
         LEFT JOIN (
           SELECT company_id, COUNT(*) AS active_count
             FROM users
            WHERE is_active = 1
            GROUP BY company_id
         ) u ON u.company_id = c.id
        WHERE c.id != ?
        ORDER BY c.is_blocked DESC, c.name`,
      [MASTER_COMPANY_ID]
    );
    res.json(rows.map(fmtCompany));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/finance/companies/:id
// Detalhe + faturas + compras de licenças
router.get('/companies/:id', auth, requireAdmin, async (req, res) => {
  try {
    await reconcileBlock(req.params.id);
    const [crows] = await db.query(
      `SELECT c.*, COALESCE(u.active_count, 0) AS active_licenses
         FROM companies c
         LEFT JOIN (
           SELECT company_id, COUNT(*) AS active_count FROM users WHERE is_active = 1 GROUP BY company_id
         ) u ON u.company_id = c.id
        WHERE c.id = ?`,
      [req.params.id]
    );
    if (!crows.length) return res.status(404).json({ error: 'Empresa não encontrada' });

    const [invoices] = await db.query(
      `SELECT * FROM company_invoices WHERE company_id = ? ORDER BY due_date DESC, created_at DESC`,
      [req.params.id]
    );
    const [purchases] = await db.query(
      `SELECT * FROM company_license_purchases WHERE company_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json({
      company: fmtCompany(crows[0]),
      invoices: invoices.map(fmtInvoice),
      licensePurchases: purchases.map(fmtLicensePurchase),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/admin/finance/companies/:id
// Atualiza configurações financeiras (billing_day, grace, preço, licenças contratadas)
router.patch('/companies/:id', auth, requireAdmin, async (req, res) => {
  const { billingDay, blockGraceDays, licensePriceCents, purchasedLicenses } = req.body;
  const sets = [], vals = [];
  if (billingDay !== undefined) {
    const d = Math.max(1, Math.min(31, parseInt(billingDay, 10) || 5));
    sets.push('billing_day = ?'); vals.push(d);
  }
  if (blockGraceDays !== undefined) {
    const g = Math.max(0, Math.min(60, parseInt(blockGraceDays, 10) || 4));
    sets.push('block_grace_days = ?'); vals.push(g);
  }
  if (licensePriceCents !== undefined) {
    sets.push('license_price_cents = ?'); vals.push(Math.max(0, parseInt(licensePriceCents, 10) || 0));
  }
  if (purchasedLicenses !== undefined) {
    sets.push('purchased_licenses = ?'); vals.push(Math.max(0, parseInt(purchasedLicenses, 10) || 0));
  }
  if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });
  vals.push(req.params.id);
  try {
    await db.query(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/finance/companies/:id/block — bloqueio manual
router.post('/companies/:id/block', auth, requireAdmin, async (req, res) => {
  const reason = (req.body?.reason ?? 'manual').slice(0, 255);
  try {
    await db.query(
      `UPDATE companies SET is_blocked = 1, blocked_at = NOW(), blocked_reason = ? WHERE id = ?`,
      [reason, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/finance/companies/:id/unblock — desbloqueio manual
router.post('/companies/:id/unblock', auth, requireAdmin, async (req, res) => {
  try {
    await db.query(
      `UPDATE companies SET is_blocked = 0, blocked_at = NULL, blocked_reason = NULL WHERE id = ?`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/finance/companies/:id/invoices — gerar fatura mensal
// Body: { periodStart, periodEnd, dueDate, licensesBilled?, unitPriceCents? }
// Se omitido, usa licenças ativas atuais e preço configurado na empresa.
router.post('/companies/:id/invoices', auth, requireAdmin, async (req, res) => {
  const companyId = req.params.id;
  let { periodStart, periodEnd, dueDate, licensesBilled, unitPriceCents, notes } = req.body;
  try {
    const [crows] = await db.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    if (!crows.length) return res.status(404).json({ error: 'Empresa não encontrada' });
    const c = crows[0];

    if (licensesBilled === undefined) {
      const [u] = await db.query('SELECT COUNT(*) AS c FROM users WHERE company_id = ? AND is_active = 1', [companyId]);
      licensesBilled = u[0].c;
    }
    if (unitPriceCents === undefined) unitPriceCents = c.license_price_cents ?? 0;
    const total = Math.max(0, parseInt(licensesBilled, 10)) * Math.max(0, parseInt(unitPriceCents, 10));

    if (!periodStart || !periodEnd || !dueDate) return res.status(400).json({ error: 'periodStart, periodEnd, dueDate são obrigatórios' });

    const id = uuidv4();
    await db.query(
      `INSERT INTO company_invoices (id, company_id, period_start, period_end, due_date,
                                     licenses_billed, unit_price_cents, total_cents, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, companyId, periodStart, periodEnd, dueDate, licensesBilled, unitPriceCents, total, notes ?? null]
    );
    const [rows] = await db.query('SELECT * FROM company_invoices WHERE id = ?', [id]);
    await reconcileBlock(companyId);
    res.status(201).json(fmtInvoice(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/admin/finance/invoices/:id — atualizar fatura
router.patch('/invoices/:id', auth, requireAdmin, async (req, res) => {
  const { status, paidAt, paymentMethod, paymentProvider, paymentProviderRef, notes, dueDate } = req.body;
  const sets = [], vals = [];
  if (status !== undefined)             { sets.push('status = ?');                vals.push(status); }
  if (paidAt !== undefined)             { sets.push('paid_at = ?');               vals.push(paidAt); }
  if (paymentMethod !== undefined)      { sets.push('payment_method = ?');        vals.push(paymentMethod); }
  if (paymentProvider !== undefined)    { sets.push('payment_provider = ?');      vals.push(paymentProvider); }
  if (paymentProviderRef !== undefined) { sets.push('payment_provider_ref = ?');  vals.push(paymentProviderRef); }
  if (notes !== undefined)              { sets.push('notes = ?');                 vals.push(notes); }
  if (dueDate !== undefined)            { sets.push('due_date = ?');              vals.push(dueDate); }
  if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });
  vals.push(req.params.id);
  try {
    await db.query(`UPDATE company_invoices SET ${sets.join(', ')} WHERE id = ?`, vals);
    const [rows] = await db.query('SELECT * FROM company_invoices WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Fatura não encontrada' });
    await reconcileBlock(rows[0].company_id);
    res.json(fmtInvoice(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/finance/invoices/:id/pay — marcar como paga
// (este endpoint é o que o webhook do gateway chamaria)
router.post('/invoices/:id/pay', auth, requireAdmin, async (req, res) => {
  const { paymentMethod, paymentProvider, paymentProviderRef } = req.body;
  try {
    await db.query(
      `UPDATE company_invoices
          SET status = 'paid', paid_at = NOW(),
              payment_method = COALESCE(?, payment_method),
              payment_provider = COALESCE(?, payment_provider),
              payment_provider_ref = COALESCE(?, payment_provider_ref)
        WHERE id = ?`,
      [paymentMethod ?? null, paymentProvider ?? null, paymentProviderRef ?? null, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM company_invoices WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Fatura não encontrada' });
    await reconcileBlock(rows[0].company_id);
    res.json(fmtInvoice(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/finance/companies/:id/license-purchases
// Inicia uma compra de licenças extras. Devolve o registro pendente —
// integração com gateway real preenche payment_provider_ref e dispara
// webhook que faz o POST /payments para confirmar.
router.post('/companies/:id/license-purchases', auth, requireAdmin, async (req, res) => {
  const { quantity, unitPriceCents } = req.body;
  const q = Math.max(1, parseInt(quantity, 10) || 0);
  const p = Math.max(0, parseInt(unitPriceCents, 10) || 0);
  if (!q) return res.status(400).json({ error: 'quantity > 0 obrigatório' });
  try {
    const id = uuidv4();
    await db.query(
      `INSERT INTO company_license_purchases (id, company_id, quantity, unit_price_cents, total_cents)
       VALUES (?, ?, ?, ?, ?)`,
      [id, req.params.id, q, p, q * p]
    );
    const [rows] = await db.query('SELECT * FROM company_license_purchases WHERE id = ?', [id]);
    res.status(201).json(fmtLicensePurchase(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/finance/license-purchases/:id/confirm
// Confirma compra (manual ou via webhook do gateway).
// Atualiza purchased_licenses na empresa e marca a compra como paga.
router.post('/license-purchases/:id/confirm', auth, requireAdmin, async (req, res) => {
  const { paymentProvider, paymentProviderRef } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM company_license_purchases WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Compra não encontrada' });
    const purchase = rows[0];
    if (purchase.status === 'paid') return res.json(fmtLicensePurchase(purchase));

    await db.query(
      `UPDATE company_license_purchases
          SET status = 'paid', paid_at = NOW(),
              payment_provider = COALESCE(?, payment_provider),
              payment_provider_ref = COALESCE(?, payment_provider_ref)
        WHERE id = ?`,
      [paymentProvider ?? null, paymentProviderRef ?? null, req.params.id]
    );
    await db.query(
      'UPDATE companies SET purchased_licenses = purchased_licenses + ? WHERE id = ?',
      [purchase.quantity, purchase.company_id]
    );

    const [updated] = await db.query('SELECT * FROM company_license_purchases WHERE id = ?', [req.params.id]);
    res.json(fmtLicensePurchase(updated[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.reconcileBlock = reconcileBlock;
module.exports.reconcileAll   = reconcileAll;
