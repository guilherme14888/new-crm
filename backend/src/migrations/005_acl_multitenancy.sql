-- ============================================================
-- Migration 005: Multi-tenant ACL
-- ============================================================

-- 1. companies
CREATE TABLE IF NOT EXISTS companies (
  id          VARCHAR(36)  NOT NULL,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  plan        VARCHAR(50)  NOT NULL DEFAULT 'starter',  -- starter | pro | enterprise
  cnpj        VARCHAR(18)  DEFAULT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_company_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default company (keeps existing data intact)
INSERT IGNORE INTO companies (id, name, slug, plan)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', 'starter');

-- 2. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id          VARCHAR(36)  NOT NULL,
  company_id  VARCHAR(36)  DEFAULT NULL,
  user_id     VARCHAR(36)  DEFAULT NULL,
  action      VARCHAR(100) NOT NULL,   -- create | update | delete | login | switch_company
  resource    VARCHAR(100) NOT NULL,   -- deals | contacts | users …
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

-- 3. Add company_id + team_id to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id,
  ADD COLUMN IF NOT EXISTS team_id    VARCHAR(36) DEFAULT NULL AFTER company_id;

-- 4. Add company_id to all resource tables
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE deals    ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE teams    ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE funnels  ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE funnel_stages      ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE custom_fields      ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE products           ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE win_loss_reasons   ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' AFTER id;
ALTER TABLE app_settings       ADD COLUMN IF NOT EXISTS company_id VARCHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
-- Change PK to composite so each company can have its own setting values
ALTER TABLE app_settings DROP PRIMARY KEY, ADD PRIMARY KEY (setting_key, company_id);

-- 5. Performance indexes for row-level isolation
ALTER TABLE users     ADD INDEX IF NOT EXISTS idx_users_company    (company_id);
ALTER TABLE contacts  ADD INDEX IF NOT EXISTS idx_contacts_company (company_id);
ALTER TABLE deals     ADD INDEX IF NOT EXISTS idx_deals_company    (company_id);
ALTER TABLE teams     ADD INDEX IF NOT EXISTS idx_teams_company    (company_id);
ALTER TABLE funnels   ADD INDEX IF NOT EXISTS idx_funnels_company  (company_id);

-- Composite indexes for role-based filtering
ALTER TABLE deals    ADD INDEX IF NOT EXISTS idx_deals_company_owner  (company_id, owner_id);
ALTER TABLE contacts ADD INDEX IF NOT EXISTS idx_contacts_company_own (company_id, id);

-- 6. Expand role enum (keep backward compat — 'agent' → 'consultant')
UPDATE users SET role = 'consultant' WHERE role = 'agent';
