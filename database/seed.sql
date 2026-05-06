-- CRM Mobile - Seed data
-- Run after schema.sql
-- Creates the admin user, default funnel, stages and win/loss reasons.

-- Admin user (password: Jifg181020)
INSERT INTO users (id, email, display_name, password_hash, role, is_active, created_at, updated_at)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'guilherme.sampaio@live.com',
  'Guilherme Sampaio',
  '$2b$10$GU1GgUTQ9ay3MVPnFBDCru3xijeQhhr2GR.uhd5CORvgjSJzdhGWu',
  'admin',
  1,
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE id = id;

-- Default funnel
INSERT INTO funnels (id, name, description, is_default, is_active, created_at, updated_at)
VALUES ('default-funnel', 'Pipeline Principal', 'Funil padrao do CRM', 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE id = id;

-- Default stages
INSERT INTO funnel_stages (id, funnel_id, name, color, order_index, probability, created_at, updated_at)
VALUES
  ('default-funnel-s1', 'default-funnel', 'Qualificacao', '#94a3b8', 0, 10,  NOW(), NOW()),
  ('default-funnel-s2', 'default-funnel', 'Descoberta',   '#3b82f6', 1, 25,  NOW(), NOW()),
  ('default-funnel-s3', 'default-funnel', 'Proposta',     '#f59e0b', 2, 50,  NOW(), NOW()),
  ('default-funnel-s4', 'default-funnel', 'Negociacao',   '#f97316', 3, 75,  NOW(), NOW()),
  ('default-funnel-s5', 'default-funnel', 'Ganho',        '#16a34a', 4, 100, NOW(), NOW()),
  ('default-funnel-s6', 'default-funnel', 'Perdido',      '#ef4444', 5, 0,   NOW(), NOW())
ON DUPLICATE KEY UPDATE id = id;

-- Win/loss reasons
INSERT INTO win_loss_reasons (id, type, label, is_active, created_at) VALUES
  ('wl-w1', 'won',  'Melhor preco',        1, NOW()),
  ('wl-w2', 'won',  'Melhor produto',      1, NOW()),
  ('wl-w3', 'won',  'Relacionamento',      1, NOW()),
  ('wl-l1', 'lost', 'Preco alto',          1, NOW()),
  ('wl-l2', 'lost', 'Escolheu concorrente',1, NOW()),
  ('wl-l3', 'lost', 'Sem budget',          1, NOW()),
  ('wl-l4', 'lost', 'Projeto cancelado',   1, NOW()),
  ('wl-l5', 'lost', 'Sem resposta',        1, NOW())
ON DUPLICATE KEY UPDATE id = id;
