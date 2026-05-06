-- Migration 011: Add location and attribute relationships to companies
-- Adds city/UF columns and master tables for porte / fornecimento / eixo /
-- segmento / produto. Products are many-to-many; the others are 1-to-1.

-- 1. Master tables (catalogs shared across the master tenant)
CREATE TABLE IF NOT EXISTS company_portes (
  id          VARCHAR(36) PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_porte_name (name)
);

CREATE TABLE IF NOT EXISTS company_fornecimentos (
  id          VARCHAR(36) PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_forn_name (name)
);

CREATE TABLE IF NOT EXISTS company_eixos (
  id          VARCHAR(36) PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_eixo_name (name)
);

CREATE TABLE IF NOT EXISTS company_segmentos (
  id          VARCHAR(36) PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_seg_name (name)
);

CREATE TABLE IF NOT EXISTS company_produtos (
  id          VARCHAR(36) PRIMARY KEY,
  name        VARCHAR(160) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_prod_name (name)
);

-- 2. New columns on companies (1-to-1 attributes + city/UF)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS city             VARCHAR(120) DEFAULT NULL AFTER cnpj,
  ADD COLUMN IF NOT EXISTS state            VARCHAR(2)   DEFAULT NULL AFTER city,
  ADD COLUMN IF NOT EXISTS porte_id         VARCHAR(36)  DEFAULT NULL AFTER state,
  ADD COLUMN IF NOT EXISTS fornecimento_id  VARCHAR(36)  DEFAULT NULL AFTER porte_id,
  ADD COLUMN IF NOT EXISTS eixo_id          VARCHAR(36)  DEFAULT NULL AFTER fornecimento_id,
  ADD COLUMN IF NOT EXISTS segmento_id      VARCHAR(36)  DEFAULT NULL AFTER eixo_id;

-- 3. Many-to-many between companies and produtos
CREATE TABLE IF NOT EXISTS company_produto_links (
  company_id  VARCHAR(36) NOT NULL,
  produto_id  VARCHAR(36) NOT NULL,
  PRIMARY KEY (company_id, produto_id),
  KEY idx_cpl_company (company_id),
  KEY idx_cpl_produto (produto_id)
);
