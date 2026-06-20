-- Migration 036: segredos de integrações globais (cifrados) — ex.: chave 2Captcha.
-- Guardados aqui para serem cadastrados pela UI (Configurações) e lidos por
-- qualquer serviço (API, scrape-worker) sem depender de variável de ambiente.
CREATE TABLE IF NOT EXISTS app_integrations (
  name       VARCHAR(64) NOT NULL PRIMARY KEY,
  value_enc  TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
