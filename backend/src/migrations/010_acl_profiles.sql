-- ============================================================
-- Migration 010: ACL Profiles (unified roles + permissions)
-- ============================================================

-- ACL profiles = roles with granular permissions
CREATE TABLE IF NOT EXISTS acl_profiles (
  id          VARCHAR(36)  NOT NULL,
  company_id  VARCHAR(36)  NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  level       INT          NOT NULL DEFAULT 1,    -- hierarchy: higher = more access
  color       VARCHAR(7)   NOT NULL DEFAULT '#64748b',
  permissions JSON         NOT NULL,
  is_system   TINYINT(1)   NOT NULL DEFAULT 0,    -- system profiles can't be deleted
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_acl_profiles_company (company_id),
  INDEX idx_acl_profiles_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Which funnels each profile can access (empty = all funnels)
CREATE TABLE IF NOT EXISTS acl_profile_funnels (
  acl_profile_id VARCHAR(36) NOT NULL,
  funnel_id      VARCHAR(36) NOT NULL,
  PRIMARY KEY (acl_profile_id, funnel_id),
  INDEX idx_apf_funnel (funnel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link users to ACL profile
ALTER TABLE users ADD COLUMN IF NOT EXISTS acl_profile_id VARCHAR(36) DEFAULT NULL AFTER role;
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_users_acl_profile (acl_profile_id);

-- ─── Seed: 4 default system profiles ──────────────────────────────────────────

-- Admin (level 4): full access
INSERT IGNORE INTO acl_profiles (id, company_id, name, description, level, color, permissions, is_system) VALUES (
  'acl-admin',
  '00000000-0000-0000-0000-000000000001',
  'Admin',
  'Acesso total à plataforma. Pode gerenciar todos os recursos e configurações.',
  4,
  '#ef4444',
  JSON_OBJECT(
    'leads_delete', true,
    'leads_reopen_won', true,
    'leads_view_all', true,
    'custom_fields_manage', true,
    'products_manage', true,
    'users_manage', true,
    'companies_manage', true,
    'teams_manage', true,
    'funnels_manage', true,
    'roles_manage', true,
    'settings_access', true
  ),
  1
);

-- Gerente (level 3): all menus, cannot edit Admin roles
INSERT IGNORE INTO acl_profiles (id, company_id, name, description, level, color, permissions, is_system) VALUES (
  'acl-manager',
  '00000000-0000-0000-0000-000000000001',
  'Gerente',
  'Acesso a todos os menus. Não pode editar perfis de Admin.',
  3,
  '#8b5cf6',
  JSON_OBJECT(
    'leads_delete', true,
    'leads_reopen_won', true,
    'leads_view_all', true,
    'custom_fields_manage', true,
    'products_manage', true,
    'users_manage', true,
    'companies_manage', true,
    'teams_manage', true,
    'funnels_manage', true,
    'roles_manage', false,
    'settings_access', true
  ),
  1
);

-- Supervisor (level 2): all menus, cannot edit Gerente/Admin, cannot see leads outside own team
INSERT IGNORE INTO acl_profiles (id, company_id, name, description, level, color, permissions, is_system) VALUES (
  'acl-supervisor',
  '00000000-0000-0000-0000-000000000001',
  'Supervisor',
  'Acesso aos menus do sistema. Não pode editar perfis de Gerente/Admin. Visualiza apenas leads da sua equipe.',
  2,
  '#3b82f6',
  JSON_OBJECT(
    'leads_delete', true,
    'leads_reopen_won', true,
    'leads_view_all', false,
    'custom_fields_manage', false,
    'products_manage', false,
    'users_manage', false,
    'companies_manage', false,
    'teams_manage', true,
    'funnels_manage', false,
    'roles_manage', false,
    'settings_access', true
  ),
  1
);

-- Consultor (level 1): only leads/negotiations
INSERT IGNORE INTO acl_profiles (id, company_id, name, description, level, color, permissions, is_system) VALUES (
  'acl-consultant',
  '00000000-0000-0000-0000-000000000001',
  'Consultor',
  'Acesso apenas ao menu de negociações/licitações.',
  1,
  '#64748b',
  JSON_OBJECT(
    'leads_delete', false,
    'leads_reopen_won', false,
    'leads_view_all', false,
    'custom_fields_manage', false,
    'products_manage', false,
    'users_manage', false,
    'companies_manage', false,
    'teams_manage', false,
    'funnels_manage', false,
    'roles_manage', false,
    'settings_access', false
  ),
  1
);
