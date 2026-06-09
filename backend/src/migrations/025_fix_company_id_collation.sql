-- Migration 025: alinhar a collation de company_id com companies.id.
-- O MariaDB 12 criou as tabelas novas com utf8mb4_uca1400_ai_ci, enquanto
-- companies.id é utf8mb4_unicode_ci → o JOIN quebrava ("Illegal mix of collations").
-- Igualar evita o erro e mantém o filtro por empresa funcionando.

ALTER TABLE market_intelligence
  MODIFY company_id VARCHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL;

ALTER TABLE market_intelligence_keywords
  MODIFY company_id VARCHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL;

ALTER TABLE market_intelligence_sources
  MODIFY company_id VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '';
