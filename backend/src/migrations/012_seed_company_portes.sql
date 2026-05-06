-- Migration 012: Seed default values for company_portes
-- Insere os portes padrão. INSERT IGNORE evita erro se já existirem
-- (a UNIQUE KEY uniq_porte_name garante a deduplicação).

INSERT IGNORE INTO company_portes (id, name) VALUES
  (UUID(), 'Associação'),
  (UUID(), 'Demais'),
  (UUID(), 'EPP'),
  (UUID(), 'LTDA'),
  (UUID(), 'ME');
