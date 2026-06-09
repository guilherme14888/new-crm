-- Migration 023: Inteligência de Mercado por TENANT (multi-empresa).
--   * Palavras-chave, configuração de API e os próprios dados passam a ter
--     company_id — cada tenant tem suas keywords, seus portais e suas licitações.
--   * Deduplicação passa a ser por (company_id, dedupe_key): a mesma licitação
--     pode ser relevante para tenants diferentes sem conflito.
--   * Keywords ganham `contexto` (descrição do negócio p/ filtro inteligente) e
--     `negativos` (termos que EXCLUEM um achado, ex.: "carrinho, obra").
-- Backfill: dados/keywords/config existentes pertencem à AstraZeneca.

SET @AZ := '2e12d416-570b-4dbe-8582-7c67d0e9cd6e';

-- ── 1. Keywords por tenant + contexto/negativos ──────────────────────────────
ALTER TABLE market_intelligence_keywords
  ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) DEFAULT NULL AFTER id,
  ADD COLUMN IF NOT EXISTS contexto   TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS negativos  TEXT        DEFAULT NULL;
UPDATE market_intelligence_keywords SET company_id = @AZ WHERE company_id IS NULL;
ALTER TABLE market_intelligence_keywords DROP INDEX IF EXISTS uniq_kw_termo;
ALTER TABLE market_intelligence_keywords ADD UNIQUE KEY uniq_kw_company_termo (company_id, termo);

-- ── 2. Config de API por tenant ──────────────────────────────────────────────
ALTER TABLE market_intelligence_sources
  ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '' AFTER source_key;
UPDATE market_intelligence_sources SET company_id = @AZ WHERE company_id = '' OR company_id IS NULL;
ALTER TABLE market_intelligence_sources DROP PRIMARY KEY, ADD PRIMARY KEY (company_id, source_key);

-- ── 3. Dados por tenant + dedupe por empresa ─────────────────────────────────
ALTER TABLE market_intelligence
  ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) DEFAULT NULL AFTER id;
UPDATE market_intelligence SET company_id = @AZ WHERE company_id IS NULL;
ALTER TABLE market_intelligence DROP INDEX IF EXISTS uniq_mi_dedupe;
ALTER TABLE market_intelligence ADD UNIQUE KEY uniq_mi_company_dedupe (company_id, dedupe_key);
ALTER TABLE market_intelligence ADD KEY IF NOT EXISTS idx_mi_company (company_id);
