-- Migration 014: Seed default values for company_fornecimentos
-- Insere os fornecimentos padrão. INSERT IGNORE evita erro se já existirem
-- (a UNIQUE KEY uniq_forn_name garante a deduplicação).

INSERT IGNORE INTO company_fornecimentos (id, name) VALUES
  (UUID(), '01 - Produto'),
  (UUID(), '02 - Serviço'),
  (UUID(), '03 - Serviço / Produto');
