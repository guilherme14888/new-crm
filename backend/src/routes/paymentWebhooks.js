/**
 * Endpoints de webhook para o gateway de pagamento.
 *
 * Este arquivo é um stub preparado para integração futura. Os endpoints
 * estão protegidos por uma chave compartilhada via header `X-Webhook-Secret`
 * (configurada em PAYMENT_WEBHOOK_SECRET no .env). Quando você plugar um
 * gateway real (Asaas / Pagar.me / Stripe / Mercado Pago), basta:
 *   1. Apontar a URL pública para POST /api/payment-webhooks/payments
 *   2. Configurar o gateway para enviar a chave em X-Webhook-Secret
 *   3. Adaptar o parser de payload no início de cada handler
 *
 * O fluxo conceitual:
 *   - Gateway processa pagamento → chama POST /payments
 *   - Identificamos a fatura ou compra de licença via providerRef
 *   - Marcamos como paga (chamando os mesmos handlers internos do finance.js)
 */
const router = require('express').Router();
const crypto = require('crypto');
const db     = require('../db');
const finance = require('./finance');

const IS_PROD = process.env.NODE_ENV === 'production';

// Comparação em tempo constante (evita timing attack na chave).
function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Valida a chave compartilhada via header X-Webhook-Secret.
// FAIL-CLOSED: em produção, sem PAYMENT_WEBHOOK_SECRET configurado, recusa tudo
// (senão qualquer um marcaria faturas como pagas / liberaria licenças).
function checkSecret(req, res, next) {
  const expected = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!expected) {
    if (IS_PROD) return res.status(503).json({ error: 'Webhook não configurado' });
    return next(); // só em dev liberamos sem secret
  }
  if (!safeEqual(req.headers['x-webhook-secret'], expected)) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }
  next();
}

// POST /api/payment-webhooks/payments
// Body genérico: { providerRef, status, kind: 'invoice' | 'license_purchase', paymentMethod?, provider? }
router.post('/payments', checkSecret, async (req, res) => {
  const { providerRef, status, kind, paymentMethod, provider } = req.body || {};
  if (!providerRef || !kind) return res.status(400).json({ error: 'providerRef e kind obrigatórios' });

  try {
    if (kind === 'invoice') {
      const [rows] = await db.query(
        'SELECT id, company_id FROM company_invoices WHERE payment_provider_ref = ?',
        [providerRef]
      );
      if (!rows.length) return res.status(404).json({ error: 'Fatura não encontrada' });
      if (status === 'paid') {
        await db.query(
          `UPDATE company_invoices
              SET status = 'paid', paid_at = NOW(),
                  payment_method = COALESCE(?, payment_method),
                  payment_provider = COALESCE(?, payment_provider)
            WHERE id = ?`,
          [paymentMethod ?? null, provider ?? null, rows[0].id]
        );
        await finance.reconcileBlock(rows[0].company_id);
      }
    } else if (kind === 'license_purchase') {
      const [rows] = await db.query(
        'SELECT id, company_id, quantity, status FROM company_license_purchases WHERE payment_provider_ref = ?',
        [providerRef]
      );
      if (!rows.length) return res.status(404).json({ error: 'Compra não encontrada' });
      if (status === 'paid' && rows[0].status !== 'paid') {
        await db.query(
          `UPDATE company_license_purchases
              SET status = 'paid', paid_at = NOW(),
                  payment_provider = COALESCE(?, payment_provider)
            WHERE id = ?`,
          [provider ?? null, rows[0].id]
        );
        await db.query(
          'UPDATE companies SET purchased_licenses = purchased_licenses + ? WHERE id = ?',
          [rows[0].quantity, rows[0].company_id]
        );
      }
    } else {
      return res.status(400).json({ error: 'kind inválido' });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
