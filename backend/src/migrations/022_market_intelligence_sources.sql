-- Migration 022: configuração dos portais (API Externa) gerenciada pelo sistema.
-- Tira as credenciais do .env e passa a guardá-las no banco (editáveis pela UI
-- em Configurações → API Externa). `config` é um JSON com os campos de cada portal.

CREATE TABLE IF NOT EXISTS market_intelligence_sources (
  source_key  VARCHAR(40) PRIMARY KEY,
  name        VARCHAR(80)  NOT NULL,
  enabled     TINYINT(1)   NOT NULL DEFAULT 0,
  config      LONGTEXT     DEFAULT NULL,   -- JSON: { api_key, base_url, username, password, token, org_key, ws_url, processes }
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;

INSERT IGNORE INTO market_intelligence_sources (source_key, name, enabled, config) VALUES
  ('pncp',         'PNCP',          1, '{}'),
  ('licitaja',     'Licitaja',      0, '{}'),
  ('bll',          'BLL',           0, '{}'),
  ('effecti',      'Effecti',       0, '{}'),
  ('conlicitacao', 'Conlicitação',  0, '{}'),
  ('forseti',      'Forseti',       0, '{}'),
  ('comprasbr',    'ComprasBR',     0, '{}');
