-- Migration 037: tuning de banco — collation + índices (mais veloz, menos peso).

-- 1) Alinha market_intelligence.pncp_controle (estava utf8mb4_uca1400_ai_ci) com
--    deals.mi_controle / company_id (utf8mb4_unicode_ci). Isso elimina o `COLLATE`
--    nos joins de oportunidade (que DERRUBAVA os índices) — agora o otimizador usa
--    idx_mi_company_controle e idx_mi_company_enc_ctrl nos JOINs por controle.
ALTER TABLE market_intelligence
  MODIFY pncp_controle VARCHAR(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL;

-- 2) market_intelligence: remove índices single-column INÚTEIS (nenhuma query
--    filtra essas colunas sem company_id; as queries multi-tenant usam os
--    compostos (company_id, ...)). Menos índices = UPSERT da ingestão mais rápido.
ALTER TABLE market_intelligence DROP INDEX IF EXISTS idx_mi_company;
ALTER TABLE market_intelligence DROP INDEX IF EXISTS idx_mi_status;
ALTER TABLE market_intelligence DROP INDEX IF EXISTS idx_mi_uf;
ALTER TABLE market_intelligence DROP INDEX IF EXISTS idx_mi_regiao;
ALTER TABLE market_intelligence DROP INDEX IF EXISTS idx_mi_etapa;
ALTER TABLE market_intelligence DROP INDEX IF EXISTS idx_mi_produto;
ALTER TABLE market_intelligence DROP INDEX IF EXISTS idx_mi_processo;

-- 3) Índice que casa a ordenação da Listagem (GET /api/market-intelligence):
--    ORDER BY first_seen_date DESC, ingested_at DESC, id — sem filesort.
ALTER TABLE market_intelligence
  ADD INDEX IF NOT EXISTS idx_mi_company_seen_ing (company_id, first_seen_date, ingested_at, id);

-- 4) deals: compostos por empresa p/ as queries de oportunidade (stage/locked).
ALTER TABLE deals
  ADD INDEX IF NOT EXISTS idx_deals_company_stage  (company_id, stage_id, deleted_at);
ALTER TABLE deals
  ADD INDEX IF NOT EXISTS idx_deals_company_locked (company_id, locked, deleted_at);

-- 5) histórico: um índice cobre o filtro (mi_id) E a ordenação (snapshot_at) da
--    linha do tempo de uma licitação. Substitui o idx_mi (só mi_id).
ALTER TABLE market_intelligence_history DROP INDEX IF EXISTS idx_mi;
ALTER TABLE market_intelligence_history
  ADD INDEX IF NOT EXISTS idx_hist_mi_snap (mi_id, snapshot_at);
