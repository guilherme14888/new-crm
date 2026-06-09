-- Migration 018: Inteligência de Mercado (Portfólio de Compras Governamentais)
-- Tabela espelhando a base "Licitações Tracker". Cada linha = um item de um
-- processo licitatório (uma linha por concorrente/oferta).
-- Catálogo compartilhado (sem company_id) — visível para todos os tenants.

CREATE TABLE IF NOT EXISTS market_intelligence (
  id                    VARCHAR(36) PRIMARY KEY,

  status                VARCHAR(40)  DEFAULT NULL,   -- Novo / Em Andamento / Encerrado
  etapa_item            VARCHAR(80)  DEFAULT NULL,
  data_ultima_atual     DATETIME     DEFAULT NULL,
  regiao                VARCHAR(40)  DEFAULT NULL,
  cnpj                  VARCHAR(32)  DEFAULT NULL,    -- CNPJ do licitador
  licitador             VARCHAR(255) DEFAULT NULL,
  uf                    VARCHAR(2)   DEFAULT NULL,
  municipio             VARCHAR(120) DEFAULT NULL,
  n_edital              VARCHAR(80)  DEFAULT NULL,
  n_edital_original     VARCHAR(80)  DEFAULT NULL,
  n_processo            VARCHAR(120) DEFAULT NULL,
  tipo_contratacao      VARCHAR(80)  DEFAULT NULL,
  modalidade            VARCHAR(80)  DEFAULT NULL,
  nome_site             VARCHAR(120) DEFAULT NULL,
  url_site              TEXT         DEFAULT NULL,
  id_site               VARCHAR(80)  DEFAULT NULL,
  prazo_edital          DATETIME     DEFAULT NULL,
  data_hora_certame     DATETIME     DEFAULT NULL,

  lote                  INT          DEFAULT NULL,
  item                  INT          DEFAULT NULL,
  produto_candidato     VARCHAR(80)  DEFAULT NULL,
  produto               VARCHAR(160) DEFAULT NULL,
  produto_licitado      TEXT         DEFAULT NULL,
  quantidade            DECIMAL(16,3) DEFAULT NULL,
  unidade_original      VARCHAR(60)  DEFAULT NULL,
  mandado_judicial      VARCHAR(8)   DEFAULT NULL,
  me_epp                VARCHAR(8)   DEFAULT NULL,

  preco_estimado_unit   DECIMAL(16,2) DEFAULT NULL,
  preco_estimado_total  DECIMAL(18,2) DEFAULT NULL,
  posicao               INT          DEFAULT NULL,
  data_posicao          DATETIME     DEFAULT NULL,
  concorrente           VARCHAR(255) DEFAULT NULL,
  cnpj_concorrente      VARCHAR(32)  DEFAULT NULL,
  uf_concorrente        VARCHAR(10)  DEFAULT NULL,
  produto_ofertado      VARCHAR(160) DEFAULT NULL,
  preco_final_unit      DECIMAL(16,2) DEFAULT NULL,
  preco_final_total     DECIMAL(18,2) DEFAULT NULL,

  etapa_sessao          VARCHAR(80)  DEFAULT NULL,
  encerramento          VARCHAR(120) DEFAULT NULL,
  processo_key          VARCHAR(255) DEFAULT NULL,    -- coluna NOME (chave do processo)
  link_edital           TEXT         DEFAULT NULL,
  link_ata              TEXT         DEFAULT NULL,
  link_doc_concorrente  TEXT         DEFAULT NULL,

  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  KEY idx_mi_produto   (produto_candidato),
  KEY idx_mi_status    (status),
  KEY idx_mi_uf        (uf),
  KEY idx_mi_regiao    (regiao),
  KEY idx_mi_etapa     (etapa_sessao),
  KEY idx_mi_processo  (processo_key)
) CHARACTER SET utf8mb4;
