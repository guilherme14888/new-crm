-- Migration 026: execução diária com recuperação (catch-up) de dias não executados.
--   * `first_seen_date` — dia em que a oportunidade foi capturada pela 1ª vez
--     (gravado só no INSERT; não muda em re-capturas). Coluna consultável.
--   * `market_intelligence_run_log` — registra, por (empresa, dia), que a mineração
--     rodou. Permite reconhecer dias faltantes e recuperá-los.
-- A deduplicação por (company_id, dedupe_key) garante que o MESMO processo×produto
-- capturado em dias diferentes NÃO seja duplicado.

ALTER TABLE market_intelligence
  ADD COLUMN IF NOT EXISTS first_seen_date DATE DEFAULT NULL AFTER ingested_at;

-- backfill: usa a data de ingestão das linhas já existentes
UPDATE market_intelligence
   SET first_seen_date = DATE(ingested_at)
 WHERE first_seen_date IS NULL AND ingested_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS market_intelligence_run_log (
  id          VARCHAR(36) PRIMARY KEY,
  company_id  VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  run_date    DATE NOT NULL,
  status      VARCHAR(20) DEFAULT 'ok',     -- ok | catchup
  inserted    INT DEFAULT 0,
  updated     INT DEFAULT 0,
  finished_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uniq_runlog (company_id, run_date),
  KEY idx_runlog_company (company_id)
) CHARACTER SET utf8mb4;
