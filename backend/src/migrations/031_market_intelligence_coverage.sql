-- Migration 031: monitoramento de COBERTURA da coleta (varredura PNCP).
--   Registra, por (empresa, dia, fonte), as métricas da varredura: quantas
--   contratações foram enumeradas, quantas passaram no pré-filtro de medicamento,
--   quantas casaram itens, quantos registros, inseridos/atualizados, erros de
--   enumeração (PNCP fora do ar) e a distribuição por UF. É a base do painel de
--   "Saúde da Coleta" — permite detectar varredura incompleta, queda de volume e
--   UFs anômalas (zeradas) antes de apresentar os dados.

CREATE TABLE IF NOT EXISTS market_intelligence_coverage (
  id            VARCHAR(36) PRIMARY KEY,
  company_id    VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  run_date      DATE NOT NULL,
  source        VARCHAR(30) NOT NULL DEFAULT 'pncp_sweep',
  enumerated    INT DEFAULT 0,     -- contratações enumeradas na janela
  pre_filtered  INT DEFAULT 0,     -- sobreviventes do pré-filtro de medicamento
  matched       INT DEFAULT 0,     -- contratações com ao menos um item casado
  records       INT DEFAULT 0,     -- registros gerados (item × concorrente)
  inserted      INT DEFAULT 0,
  updated       INT DEFAULT 0,
  enum_errors   INT DEFAULT 0,     -- falhas de enumeração (indisponibilidade do PNCP)
  by_uf         JSON NULL,         -- {"SP":12,"RJ":3,...} registros por UF
  modalidades   VARCHAR(60) NULL,  -- modalidades varridas (ex.: "6,8,9,4")
  finished_at   TIMESTAMP NULL DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cov (company_id, run_date, source),
  KEY idx_cov_company (company_id, run_date)
) CHARACTER SET utf8mb4;
