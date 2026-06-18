-- Migration 033: período de teste (trial) por empresa.
--   O admin define `trial_days` (X dias) e inicia o período (`trial_starts_at`).
--   Enquanto ativo, o app mostra um contador; ao expirar, o login dos usuários
--   não-admin é bloqueado com mensagem para contatar o financeiro.
--   trial inativo = trial_starts_at NULL ou trial_days NULL/0.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_days INT NULL DEFAULT NULL;
