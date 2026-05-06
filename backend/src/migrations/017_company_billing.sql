-- Migration 017: Financeiro / Cobrança
-- Adiciona campos de cobrança em companies e cria a tabela de faturas.
-- A cobrança é por "licença" = usuário ativo. Cada empresa tem um dia
-- do mês para vencimento da fatura mensal e um período de tolerância
-- (default 4 dias) antes do bloqueio automático.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS billing_day            TINYINT      NOT NULL DEFAULT 5    AFTER segmento_id,
  ADD COLUMN IF NOT EXISTS block_grace_days       TINYINT      NOT NULL DEFAULT 4    AFTER billing_day,
  ADD COLUMN IF NOT EXISTS license_price_cents    INT          NOT NULL DEFAULT 0    AFTER block_grace_days,
  ADD COLUMN IF NOT EXISTS purchased_licenses     INT          NOT NULL DEFAULT 0    AFTER license_price_cents,
  ADD COLUMN IF NOT EXISTS is_blocked             TINYINT(1)   NOT NULL DEFAULT 0    AFTER purchased_licenses,
  ADD COLUMN IF NOT EXISTS blocked_at             TIMESTAMP    NULL                  AFTER is_blocked,
  ADD COLUMN IF NOT EXISTS blocked_reason         VARCHAR(255) NULL                  AFTER blocked_at,
  ADD COLUMN IF NOT EXISTS payment_provider       VARCHAR(50)  NULL                  AFTER blocked_reason,
  ADD COLUMN IF NOT EXISTS payment_provider_ref   VARCHAR(120) NULL                  AFTER payment_provider;

CREATE TABLE IF NOT EXISTS company_invoices (
  id                  VARCHAR(36) PRIMARY KEY,
  company_id          VARCHAR(36)  NOT NULL,
  period_start        DATE         NOT NULL,
  period_end          DATE         NOT NULL,
  due_date            DATE         NOT NULL,
  licenses_billed     INT          NOT NULL DEFAULT 0,
  unit_price_cents    INT          NOT NULL DEFAULT 0,
  total_cents         INT          NOT NULL DEFAULT 0,
  status              ENUM('open','paid','overdue','canceled') NOT NULL DEFAULT 'open',
  paid_at             TIMESTAMP    NULL,
  payment_method      VARCHAR(50)  NULL,
  payment_provider    VARCHAR(50)  NULL,
  payment_provider_ref VARCHAR(120) NULL,
  notes               TEXT         NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_inv_company       (company_id),
  KEY idx_inv_status_due    (status, due_date),
  KEY idx_inv_company_due   (company_id, due_date)
);

-- Compras avulsas de licenças extras (fora do ciclo mensal)
CREATE TABLE IF NOT EXISTS company_license_purchases (
  id                  VARCHAR(36) PRIMARY KEY,
  company_id          VARCHAR(36)  NOT NULL,
  quantity            INT          NOT NULL,
  unit_price_cents    INT          NOT NULL,
  total_cents         INT          NOT NULL,
  status              ENUM('pending','paid','failed','canceled') NOT NULL DEFAULT 'pending',
  paid_at             TIMESTAMP    NULL,
  payment_provider    VARCHAR(50)  NULL,
  payment_provider_ref VARCHAR(120) NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_lp_company  (company_id),
  KEY idx_lp_status   (status)
);
