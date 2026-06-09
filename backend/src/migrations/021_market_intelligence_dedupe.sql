-- Migration 021: deduplicação GLOBAL entre portais.
--   * `dedupe_key`  → identidade canônica da licitação (órgão + processo + lote + item + concorrente),
--                    independente do portal de origem. Índice ÚNICO garante zero duplicidade.
--   * `fontes`      → lista de portais onde a mesma licitação foi vista (provenância).
-- Remove a unicidade antiga por external_key (passa a ser só provenância da fonte).

ALTER TABLE market_intelligence
  ADD COLUMN IF NOT EXISTS fontes     VARCHAR(255) DEFAULT NULL AFTER fonte,
  ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(255) DEFAULT NULL AFTER external_key;

-- libera o external_key (não é mais a chave de unicidade)
ALTER TABLE market_intelligence DROP INDEX uniq_mi_external;

-- popula a chave canônica para as linhas já existentes (PNCP + MANUAL)
UPDATE market_intelligence SET dedupe_key = CONCAT_WS('|',
  REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', ''),
  LOWER(REPLACE(COALESCE(NULLIF(n_processo, ''), NULLIF(n_edital, ''), processo_key, id), ' ', '')),
  COALESCE(lote, 0),
  COALESCE(item, 0),
  COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(cnpj_concorrente, ''), '[^0-9]', ''), ''), '-')
);

UPDATE market_intelligence SET fontes = COALESCE(fontes, fonte);

-- remove duplicatas pré-existentes mantendo o menor id
DELETE m1 FROM market_intelligence m1
  JOIN market_intelligence m2
    ON m1.dedupe_key = m2.dedupe_key AND m1.id > m2.id;

ALTER TABLE market_intelligence ADD UNIQUE KEY uniq_mi_dedupe (dedupe_key);
