-- Migration 024: cache do filtro de relevância (reduz custo de IA).
--   * cache EXATO: reaproveita o veredito por (empresa, termo, descrição). Grátis
--     a partir da 2ª vez — a varredura diária repete muitos itens.
--   * cache SEMÂNTICO (vetorial): guarda o embedding do item + veredito; um item
--     novo parecido reaproveita o veredito de um já julgado (1 embedding, sem LLM).
--     Usa VECTOR nativo do MariaDB (cosine). Só é populado quando há provedor de
--     embeddings configurado (Voyage/OpenAI) — fica dormente caso contrário.

CREATE TABLE IF NOT EXISTS market_intelligence_relevance_cache (
  cache_key   CHAR(64) PRIMARY KEY,          -- sha256(company|termo|descNorm)
  company_id  VARCHAR(36),
  termo       VARCHAR(120),
  verdict     TINYINT(1) NOT NULL,           -- 1 = relevante, 0 = fora de contexto
  model       VARCHAR(60),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_relcache_company (company_id)
) CHARACTER SET utf8mb4;

-- Cache semântico (vetorial). Dimensão 1024 (Voyage voyage-3.5-lite / OpenAI
-- text-embedding-3-small com dimensions=1024). Ajuste a dimensão se trocar o modelo.
CREATE TABLE IF NOT EXISTS market_intelligence_relevance_vec (
  id          VARCHAR(36) PRIMARY KEY,
  company_id  VARCHAR(36) NOT NULL,
  termo       VARCHAR(120),
  descricao   TEXT,
  verdict     TINYINT(1) NOT NULL,
  embedding   VECTOR(1024) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_relvec_company (company_id),
  VECTOR INDEX (embedding)
) CHARACTER SET utf8mb4;
