-- Liga deals às licitações de origem (oportunidades do PNCP) e habilita anexar
-- os documentos copiados (edital/ata/anexos) na aba Arquivos da negociação.

-- Vínculo deal ↔ licitação (pncp_controle da origem) — evita confirmar 2x a mesma.
ALTER TABLE deals ADD COLUMN mi_controle VARCHAR(255) NULL;
CREATE INDEX idx_deals_mi_controle ON deals (company_id, mi_controle);

-- Arquivos do deal: guardar os bytes (cópia) + identificação (edital/ata/outro).
ALTER TABLE deal_files ADD COLUMN kind VARCHAR(16) NULL;
ALTER TABLE deal_files ADD COLUMN viewable TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE deal_files ADD COLUMN conteudo LONGBLOB NULL;
