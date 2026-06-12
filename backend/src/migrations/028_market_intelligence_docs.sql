-- Cache dos documentos (edital/ata) baixados do PNCP para dentro do CRM.
-- Um documento por (empresa, licitação, tipo). PDF é renderizável no leitor;
-- demais formatos (ex.: zip só com .docx) viram download.
CREATE TABLE IF NOT EXISTS market_intelligence_docs (
  id            VARCHAR(64)  NOT NULL,
  company_id    VARCHAR(36),
  pncp_controle VARCHAR(255),
  tipo          VARCHAR(16)  NOT NULL,      -- 'edital' | 'ata'
  filename      VARCHAR(512),
  mime          VARCHAR(128),
  viewable      TINYINT(1)   DEFAULT 0,     -- 1 = PDF (abre no leitor embutido)
  size_bytes    INT,
  source_url    VARCHAR(1024),
  conteudo      LONGBLOB,
  fetched_at    DATETIME,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_doc (company_id, pncp_controle, tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
