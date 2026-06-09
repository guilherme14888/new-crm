-- Migration 020: Suporte à ingestão automática de licitações (PNCP e outros portais).
--   * Colunas de origem + chave de deduplicação (idempotência ao reprocessar).
--   * Tabela de palavras-chave (nomes de remédios / princípios ativos) que dirigem a busca.

ALTER TABLE market_intelligence
  ADD COLUMN IF NOT EXISTS fonte         VARCHAR(40)  DEFAULT 'MANUAL' AFTER id,
  ADD COLUMN IF NOT EXISTS pncp_controle VARCHAR(60)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS termo_busca   VARCHAR(120) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS external_key  VARCHAR(200) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ingested_at   TIMESTAMP    NULL DEFAULT NULL;

-- Chave única para upsert idempotente (linhas legadas ficam com NULL → não conflitam).
ALTER TABLE market_intelligence
  ADD UNIQUE KEY uniq_mi_external (external_key);

-- Palavras-chave do cliente (já existentes como nomes de remédios na base).
-- `termo` é o que vai para a busca do portal; `produto_candidato` classifica o achado.
CREATE TABLE IF NOT EXISTS market_intelligence_keywords (
  id                VARCHAR(36) PRIMARY KEY,
  termo             VARCHAR(120) NOT NULL,
  produto_candidato VARCHAR(80)  DEFAULT NULL,
  ativo             TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_kw_termo (termo)
) CHARACTER SET utf8mb4;

-- Seed: marca + princípio ativo de cada produto do portfólio.
INSERT IGNORE INTO market_intelligence_keywords (id, termo, produto_candidato) VALUES
  ('kw-001', 'acalabrutinibe',                      'CALQUENCE'),
  ('kw-002', 'calquence',                           'CALQUENCE'),
  ('kw-003', 'benralizumabe',                       'FASENRA'),
  ('kw-004', 'fasenra',                             'FASENRA'),
  ('kw-005', 'olaparibe',                           'LYNPARZA'),
  ('kw-006', 'lynparza',                            'LYNPARZA'),
  ('kw-007', 'osimertinibe',                        'TAGRISSO'),
  ('kw-008', 'tagrisso',                            'TAGRISSO'),
  ('kw-009', 'tezepelumabe',                        'TEZSPIRE'),
  ('kw-010', 'tezspire',                            'TEZSPIRE'),
  ('kw-011', 'gosserrelina',                        'ZOLADEX'),
  ('kw-012', 'zoladex',                             'ZOLADEX'),
  ('kw-013', 'ciclossilicato de zircônio sódico',   'LOKELMA'),
  ('kw-014', 'lokelma',                             'LOKELMA');
