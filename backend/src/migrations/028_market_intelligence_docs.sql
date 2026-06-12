-- Cache dos documentos (edital/ata) baixados do PNCP para dentro do CRM.
-- O documento do PNCP costuma ser um .zip (às vezes com zip aninhado, ex.: ComprasGov)
-- contendo vários PDFs. Guardamos UMA LINHA POR PDF extraído (idx), para o leitor
-- listar os arquivos e abrir cada um. PDF é renderizável; demais formatos viram download.
CREATE TABLE IF NOT EXISTS market_intelligence_docs (
  id            VARCHAR(64)  NOT NULL,
  company_id    VARCHAR(36),
  pncp_controle VARCHAR(255),
  tipo          VARCHAR(16)  NOT NULL,      -- 'edital' | 'ata'
  idx           INT          NOT NULL DEFAULT 0,  -- índice do arquivo dentro do documento
  filename      VARCHAR(512),
  mime          VARCHAR(128),
  viewable      TINYINT(1)   DEFAULT 0,     -- 1 = PDF (abre no leitor embutido)
  size_bytes    INT,
  source_url    VARCHAR(1024),
  conteudo      LONGBLOB,
  fetched_at    DATETIME,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_doc (company_id, pncp_controle, tipo, idx)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
