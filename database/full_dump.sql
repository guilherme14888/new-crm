-- ============================================================
-- CRM BR4 - Dump completo do banco de dados
-- Gerado em: 2026-04-14
-- Banco: MariaDB/MySQL
-- Charset: utf8mb4
-- ============================================================
-- Instrucoes:
--   1. Crie o banco:  CREATE DATABASE crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   2. Execute:       mysql -u root -p crm < full_dump.sql
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- SCHEMA BASE (database/schema.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL,
  email         VARCHAR(255) NOT NULL,
  display_name  VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url    TEXT,
  role          VARCHAR(20)  NOT NULL DEFAULT 'agent',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_login_at DATETIME(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  id          CHAR(36)     NOT NULL,
  type        VARCHAR(20)  NOT NULL DEFAULT 'lead',
  first_name  VARCHAR(255) NOT NULL,
  last_name   VARCHAR(255) NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(50),
  company     VARCHAR(255),
  job_title   VARCHAR(255),
  avatar_url  TEXT,
  tags        JSON         NOT NULL,
  notes       TEXT,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at  DATETIME(3),
  PRIMARY KEY (id),
  INDEX idx_type    (type),
  INDEX idx_deleted (deleted_at),
  INDEX idx_name    (first_name, last_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS funnels (
  id          CHAR(36)     NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  is_default  TINYINT(1)   NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_active  (is_active),
  INDEX idx_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS funnel_stages (
  id          CHAR(36)     NOT NULL,
  funnel_id   CHAR(36)     NOT NULL,
  name        VARCHAR(255) NOT NULL,
  color       VARCHAR(20)  NOT NULL DEFAULT '#94a3b8',
  order_index INT          NOT NULL DEFAULT 0,
  probability INT          NOT NULL DEFAULT 10,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  FOREIGN KEY (funnel_id) REFERENCES funnels(id) ON DELETE CASCADE,
  INDEX idx_funnel (funnel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deals (
  id                  CHAR(36)     NOT NULL,
  contact_id          CHAR(36)     NOT NULL,
  funnel_id           VARCHAR(36)  NOT NULL DEFAULT 'default-funnel',
  stage_id            VARCHAR(36)  NOT NULL DEFAULT '',
  owner_id            CHAR(36),
  title               VARCHAR(255) NOT NULL,
  value               BIGINT       NOT NULL DEFAULT 0,
  currency            VARCHAR(10)  NOT NULL DEFAULT 'BRL',
  stage               VARCHAR(50)  NOT NULL DEFAULT 'qualification',
  stage_order         DOUBLE       NOT NULL DEFAULT 0,
  probability         INT          NOT NULL DEFAULT 10,
  expected_close_date DATE,
  closing_reason      TEXT,
  notes               TEXT,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at          DATETIME(3),
  PRIMARY KEY (id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  INDEX idx_stage    (stage),
  INDEX idx_funnel   (funnel_id),
  INDEX idx_stage_id (stage_id),
  INDEX idx_owner    (owner_id),
  INDEX idx_deleted  (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activities (
  id          CHAR(36)     NOT NULL,
  deal_id     CHAR(36),
  contact_id  CHAR(36)     NOT NULL,
  type        VARCHAR(50)  NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  occurred_at DATETIME(3)  NOT NULL,
  metadata    JSON,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  FOREIGN KEY (deal_id)    REFERENCES deals(id)    ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  INDEX idx_contact (contact_id),
  INDEX idx_deal    (deal_id),
  INDEX idx_date    (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS opportunity_rules (
  id             CHAR(36)     NOT NULL,
  funnel_id      CHAR(36)     NOT NULL,
  name           VARCHAR(255) NOT NULL,
  trigger_type   VARCHAR(50)  NOT NULL,
  trigger_config JSON         NOT NULL,
  action_type    VARCHAR(50)  NOT NULL,
  action_config  JSON         NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  FOREIGN KEY (funnel_id) REFERENCES funnels(id) ON DELETE CASCADE,
  INDEX idx_funnel (funnel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS win_loss_reasons (
  id         CHAR(36)     NOT NULL,
  type       VARCHAR(10)  NOT NULL,
  label      VARCHAR(255) NOT NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_meta (
  table_name     VARCHAR(50) NOT NULL,
  last_pulled_at DATETIME(3),
  PRIMARY KEY (table_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MIGRATION 002: Deal detail (tasks, custom fields, products, files, settings)
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id              VARCHAR(36) NOT NULL,
  deal_id         VARCHAR(36) NOT NULL,
  assigned_to     VARCHAR(36) DEFAULT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT DEFAULT NULL,
  type            VARCHAR(50) NOT NULL DEFAULT 'to_do',
  due_date        DATETIME DEFAULT NULL,
  completed_at    DATETIME DEFAULT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_tasks_deal (deal_id),
  INDEX idx_tasks_assigned (assigned_to),
  CONSTRAINT fk_tasks_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_fields (
  id              VARCHAR(36) NOT NULL,
  entity_type     VARCHAR(50) NOT NULL DEFAULT 'deal',
  name            VARCHAR(255) NOT NULL,
  field_type      VARCHAR(50) NOT NULL DEFAULT 'text',
  options         JSON DEFAULT NULL,
  field_order     INT NOT NULL DEFAULT 0,
  is_required     TINYINT(1) NOT NULL DEFAULT 0,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_cf_entity (entity_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deal_custom_values (
  id              VARCHAR(36) NOT NULL,
  deal_id         VARCHAR(36) NOT NULL,
  field_id        VARCHAR(36) NOT NULL,
  value           TEXT DEFAULT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_deal_field (deal_id, field_id),
  INDEX idx_dcv_deal (deal_id),
  CONSTRAINT fk_dcv_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  CONSTRAINT fk_dcv_field FOREIGN KEY (field_id) REFERENCES custom_fields(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id              VARCHAR(36) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT DEFAULT NULL,
  unit_price      BIGINT NOT NULL DEFAULT 0,
  currency        VARCHAR(3) NOT NULL DEFAULT 'BRL',
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deal_products (
  id              VARCHAR(36) NOT NULL,
  deal_id         VARCHAR(36) NOT NULL,
  product_id      VARCHAR(36) NOT NULL,
  quantity        DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price      BIGINT NOT NULL DEFAULT 0,
  discount        DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_dp_deal (deal_id),
  CONSTRAINT fk_dp_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  CONSTRAINT fk_dp_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deal_files (
  id              VARCHAR(36) NOT NULL,
  deal_id         VARCHAR(36) NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  file_url        TEXT NOT NULL,
  file_size       BIGINT DEFAULT 0,
  mime_type       VARCHAR(100) DEFAULT NULL,
  uploaded_by     VARCHAR(36) DEFAULT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_df_deal (deal_id),
  CONSTRAINT fk_df_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key     VARCHAR(100) NOT NULL,
  setting_value   JSON NOT NULL,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('cooling_thresholds', '{"warningDays": 15, "dangerDays": 30}');

ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_changed_at DATETIME DEFAULT NULL;

-- ============================================================
-- MIGRATION 003: Teams
-- ============================================================

CREATE TABLE IF NOT EXISTS teams (
  id          VARCHAR(36) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  color       VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS team_members (
  id          VARCHAR(36) NOT NULL,
  team_id     VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  role        VARCHAR(50) NOT NULL DEFAULT 'member',
  joined_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_team_user (team_id, user_id),
  INDEX idx_tm_team (team_id),
  CONSTRAINT fk_tm_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_tm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MIGRATION 004: Stage type
-- ============================================================

ALTER TABLE funnel_stages
  ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'active'
  AFTER probability;

-- ============================================================
-- MIGRATION 005: Multi-tenant ACL
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  id          VARCHAR(36)  NOT NULL,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  plan        VARCHAR(50)  NOT NULL DEFAULT 'starter',
  cnpj        VARCHAR(18)  DEFAULT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_company_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO companies (id, name, slug, plan)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', 'starter');

CREATE TABLE IF NOT EXISTS audit_logs (
  id          VARCHAR(36)  NOT NULL,
  company_id  VARCHAR(36)  DEFAULT NULL,
  user_id     VARCHAR(36)  DEFAULT NULL,
  action      VARCHAR(100) NOT NULL,
  resource    VARCHAR(100) NOT NULL,
  resource_id VARCHAR(36)  DEFAULT NULL,
  old_value   JSON         DEFAULT NULL,
  new_value   JSON         DEFAULT NULL,
  ip_address  VARCHAR(45)  DEFAULT NULL,
  user_agent  VARCHAR(255) DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_audit_company    (company_id),
  INDEX idx_audit_user       (user_id),
  INDEX idx_audit_resource   (resource, resource_id),
  INDEX idx_audit_created    (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id,
  ADD COLUMN IF NOT EXISTS team_id    VARCHAR(36) DEFAULT NULL AFTER company_id;

ALTER TABLE contacts       ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE deals          ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE teams          ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE funnels        ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE funnel_stages  ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE custom_fields  ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE products       ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE win_loss_reasons ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE app_settings   ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE app_settings DROP PRIMARY KEY, ADD PRIMARY KEY (setting_key, company_id);

ALTER TABLE users     ADD INDEX IF NOT EXISTS idx_users_company    (company_id);
ALTER TABLE contacts  ADD INDEX IF NOT EXISTS idx_contacts_company (company_id);
ALTER TABLE deals     ADD INDEX IF NOT EXISTS idx_deals_company    (company_id);
ALTER TABLE teams     ADD INDEX IF NOT EXISTS idx_teams_company    (company_id);
ALTER TABLE funnels   ADD INDEX IF NOT EXISTS idx_funnels_company  (company_id);

ALTER TABLE deals    ADD INDEX IF NOT EXISTS idx_deals_company_owner  (company_id, owner_id);
ALTER TABLE contacts ADD INDEX IF NOT EXISTS idx_contacts_company_own (company_id, id);

UPDATE users SET role = 'consultant' WHERE role = 'agent';

-- ============================================================
-- MIGRATION 006: CNPJ (ja incluido na tabela companies acima)
-- ============================================================
-- ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18) DEFAULT NULL AFTER plan;

-- ============================================================
-- MIGRATION 007: Fix funnel_stages company_id
-- ============================================================

UPDATE funnel_stages fs
  JOIN funnels f ON f.id = fs.funnel_id
  SET fs.company_id = f.company_id
  WHERE fs.company_id = '00000000-0000-0000-0000-000000000001'
    AND f.company_id != '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- MIGRATION 008: user_companies (multi-company membership)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_companies (
  user_id    VARCHAR(36) NOT NULL,
  company_id VARCHAR(36) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, company_id),
  INDEX idx_uc_company (company_id),
  CONSTRAINT fk_uc_user    FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_uc_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO user_companies (user_id, company_id)
  SELECT id, company_id FROM users WHERE company_id IS NOT NULL;

-- ============================================================
-- MIGRATION 009: Avatar MEDIUMTEXT
-- ============================================================

ALTER TABLE users MODIFY COLUMN avatar_url MEDIUMTEXT DEFAULT NULL;

-- ============================================================
-- SEED DATA
-- ============================================================

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

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- FIM DO DUMP
-- ============================================================
