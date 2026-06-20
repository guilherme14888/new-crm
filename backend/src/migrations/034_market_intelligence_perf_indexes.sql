-- Migration 034: índices compostos por tenant para escala.
-- Os índices antigos de market_intelligence eram single-column SEM company_id na
-- frente (idx_mi_status/uf/regiao/etapa) → inúteis para queries multi-tenant, que
-- SEMPRE filtram por empresa primeiro. Estes compostos cobrem os caminhos quentes:
--   - listagem/ordenação (GET /api/market-intelligence)
--   - lookup por controle (abrir deal / aba Arquivos / participar)
--   - histórico de mineração (first_seen_date × termo_busca)
--   - sincronização de oportunidades (encerramento + controle)
--   - cobertura (COUNT por uf)
-- E o MAX(stage_order) por estágio em deals.

ALTER TABLE market_intelligence
  ADD INDEX IF NOT EXISTS idx_mi_company_certame   (company_id, data_hora_certame, id),
  ADD INDEX IF NOT EXISTS idx_mi_company_controle  (company_id, pncp_controle),
  ADD INDEX IF NOT EXISTS idx_mi_company_seen_termo (company_id, first_seen_date, termo_busca),
  ADD INDEX IF NOT EXISTS idx_mi_company_enc_ctrl  (company_id, encerramento, pncp_controle),
  ADD INDEX IF NOT EXISTS idx_mi_company_uf        (company_id, uf);

ALTER TABLE deals
  ADD INDEX IF NOT EXISTS idx_deals_stage_order (stage_id, deleted_at, stage_order);
