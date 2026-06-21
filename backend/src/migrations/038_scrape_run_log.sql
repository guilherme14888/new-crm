-- Migration 038: log diário de execução do scrape-worker, POR PORTAL.
-- Registra, a cada execução, o resultado de CADA portal (e tenant quando aplicável):
--   status = ok | fail | sem_conector | sem_keywords
--   detail = motivo da falha / observação (ex.: "CAPTCHA ausente", "timeout")
-- Assim você vê todo dia quais portais rodaram, quais falharam e por quê.
CREATE TABLE IF NOT EXISTS scrape_run_log (
  id          BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  run_date    DATE NOT NULL,
  company_id  VARCHAR(36) NULL,            -- nulo p/ status de portal (ex.: sem_conector)
  portal      VARCHAR(64) NOT NULL,        -- chave do portal (bec_sp, licitanet, ...)
  portal_nome VARCHAR(120) NULL,
  status      VARCHAR(20) NOT NULL,        -- ok | fail | sem_conector | sem_keywords
  detail      TEXT NULL,                   -- erro/motivo (falha especificada)
  inserted    INT NOT NULL DEFAULT 0,
  updated     INT NOT NULL DEFAULT 0,
  errors      INT NOT NULL DEFAULT 0,
  finished_at DATETIME NULL,
  UNIQUE KEY uk_scrape (run_date, company_id, portal),
  INDEX idx_scrape_date (run_date),
  INDEX idx_scrape_status (run_date, status)
);
