-- Migration 035: estado de throttle/cooldown da ingestão por host (PNCP, etc).
-- O circuit breaker grava aqui o "cooldown_until" ao tomar 429 — assim o worker,
-- execuções manuais e reinícios respeitam a MESMA pausa (nunca somam carga ao PNCP).
CREATE TABLE IF NOT EXISTS ingest_throttle (
  host           VARCHAR(64) NOT NULL PRIMARY KEY,
  cooldown_until DATETIME NULL,
  reason         VARCHAR(255) NULL,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
