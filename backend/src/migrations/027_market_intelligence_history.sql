-- Histórico da licitação (snapshots de transição): cada vez que uma linha de
-- market_intelligence muda de status/situação/posição/vencedor/preço final, um
-- snapshot é gravado aqui. Permite mostrar a evolução (aberta → fechada c/ vencedor)
-- sem poluir a listagem principal (lido sob demanda por linha).
CREATE TABLE IF NOT EXISTS market_intelligence_history (
  id                VARCHAR(48)  NOT NULL,
  company_id        VARCHAR(36),
  mi_id             VARCHAR(36)  NOT NULL,
  dedupe_key        VARCHAR(255),
  status            VARCHAR(64),
  encerramento      VARCHAR(128),
  etapa_sessao      VARCHAR(255),
  posicao           INT,
  concorrente       VARCHAR(255),
  cnpj_concorrente  VARCHAR(32),
  preco_final_unit  DECIMAL(18,4),
  preco_final_total DECIMAL(18,4),
  snapshot_at       DATETIME     NOT NULL,
  run_date          DATE,
  PRIMARY KEY (id),
  INDEX idx_mi (mi_id),
  INDEX idx_company_dedupe (company_id, dedupe_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
