-- ─── CRM Mobile — Migration 003: Multi-funnel schema + team access ───────────
-- Run this in: Supabase Dashboard > SQL Editor

-- ─── 1. Alter existing deals table ───────────────────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS funnel_id      TEXT DEFAULT 'default-funnel';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_id       TEXT DEFAULT '';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS owner_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS closing_reason TEXT;

-- ─── 2. Funnels (shared across all users) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS funnels (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. Funnel stages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funnel_stages (
  id          TEXT PRIMARY KEY,
  funnel_id   TEXT NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#94a3b8',
  stage_order INTEGER NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 10,
  type        TEXT NOT NULL DEFAULT 'active' CHECK (type IN ('active', 'won', 'lost')),
  rotten_days INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. Opportunity rules ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS opportunity_rules (
  id             TEXT PRIMARY KEY,
  funnel_id      TEXT NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  trigger        TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action         TEXT NOT NULL,
  action_config  JSONB NOT NULL DEFAULT '{}',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. Win / loss reasons (shared) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS win_loss_reasons (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('won', 'lost')),
  label      TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. CRM users (mirrors auth.users for frontend management) ────────────────
CREATE TABLE IF NOT EXISTS crm_users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- ─── 7. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_funnel_stages_funnel ON funnel_stages(funnel_id);
CREATE INDEX IF NOT EXISTS idx_deals_funnel         ON deals(funnel_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_stage_id       ON deals(stage_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_owner          ON deals(owner_id)   WHERE deleted_at IS NULL;

-- ─── 8. RLS — replace per-user policies with team-level access ───────────────
-- Contacts
DROP POLICY IF EXISTS contacts_select ON contacts;
DROP POLICY IF EXISTS contacts_insert ON contacts;
DROP POLICY IF EXISTS contacts_update ON contacts;
DROP POLICY IF EXISTS contacts_delete ON contacts;
DROP POLICY IF EXISTS contacts_all    ON contacts;
CREATE POLICY contacts_all ON contacts FOR ALL USING (auth.role() = 'authenticated');

-- Deals
DROP POLICY IF EXISTS deals_select ON deals;
DROP POLICY IF EXISTS deals_insert ON deals;
DROP POLICY IF EXISTS deals_update ON deals;
DROP POLICY IF EXISTS deals_delete ON deals;
DROP POLICY IF EXISTS deals_all    ON deals;
CREATE POLICY deals_all ON deals FOR ALL USING (auth.role() = 'authenticated');

-- Activities
DROP POLICY IF EXISTS activities_select ON activities;
DROP POLICY IF EXISTS activities_insert ON activities;
DROP POLICY IF EXISTS activities_update ON activities;
DROP POLICY IF EXISTS activities_all    ON activities;
CREATE POLICY activities_all ON activities FOR ALL USING (auth.role() = 'authenticated');

-- Funnels
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS funnels_all ON funnels;
CREATE POLICY funnels_all ON funnels FOR ALL USING (auth.role() = 'authenticated');

-- Funnel stages
ALTER TABLE funnel_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS funnel_stages_all ON funnel_stages;
CREATE POLICY funnel_stages_all ON funnel_stages FOR ALL USING (auth.role() = 'authenticated');

-- Opportunity rules
ALTER TABLE opportunity_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS opportunity_rules_all ON opportunity_rules;
CREATE POLICY opportunity_rules_all ON opportunity_rules FOR ALL USING (auth.role() = 'authenticated');

-- Win/loss reasons
ALTER TABLE win_loss_reasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS win_loss_reasons_all ON win_loss_reasons;
CREATE POLICY win_loss_reasons_all ON win_loss_reasons FOR ALL USING (auth.role() = 'authenticated');

-- CRM users
ALTER TABLE crm_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_users_select ON crm_users;
DROP POLICY IF EXISTS crm_users_all    ON crm_users;
CREATE POLICY crm_users_select ON crm_users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY crm_users_write  ON crm_users FOR ALL    USING (auth.role() = 'authenticated');

-- ─── 9. Auto-create crm_users row on signup ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.crm_users (id, email, display_name, avatar_url, role, is_active, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'admin',
    TRUE,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 10. Seed: default funnel + stages + win/loss reasons ─────────────────────
INSERT INTO funnels (id, name, description, is_default, is_active, created_at, updated_at)
VALUES ('default-funnel', 'Pipeline Principal', 'Funil padrão do CRM', TRUE, TRUE, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO funnel_stages (id, funnel_id, name, color, stage_order, probability, type, created_at, updated_at)
VALUES
  ('default-funnel-s1', 'default-funnel', 'Qualificação', '#94a3b8', 0, 10,  'active', NOW(), NOW()),
  ('default-funnel-s2', 'default-funnel', 'Descoberta',   '#3b82f6', 1, 25,  'active', NOW(), NOW()),
  ('default-funnel-s3', 'default-funnel', 'Proposta',     '#f59e0b', 2, 50,  'active', NOW(), NOW()),
  ('default-funnel-s4', 'default-funnel', 'Negociação',   '#f97316', 3, 75,  'active', NOW(), NOW()),
  ('default-funnel-s5', 'default-funnel', 'Ganho',        '#16a34a', 4, 100, 'won',    NOW(), NOW()),
  ('default-funnel-s6', 'default-funnel', 'Perdido',      '#ef4444', 5, 0,   'lost',   NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO win_loss_reasons (id, type, label, is_active, created_at) VALUES
  ('wl-w1', 'won',  'Melhor preço',          TRUE, NOW()),
  ('wl-w2', 'won',  'Melhor produto',         TRUE, NOW()),
  ('wl-w3', 'won',  'Relacionamento',         TRUE, NOW()),
  ('wl-l1', 'lost', 'Preço alto',             TRUE, NOW()),
  ('wl-l2', 'lost', 'Escolheu concorrente',   TRUE, NOW()),
  ('wl-l3', 'lost', 'Sem budget',             TRUE, NOW()),
  ('wl-l4', 'lost', 'Projeto cancelado',      TRUE, NOW()),
  ('wl-l5', 'lost', 'Sem resposta',           TRUE, NOW())
ON CONFLICT (id) DO NOTHING;

-- ─── 11. Create application user (Guilherme Sampaio) ─────────────────────────
-- This inserts the auth user directly, bypassing email confirmation requirements.
-- Required if "Email logins" provider is not yet enabled in the Supabase dashboard.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id UUID;
  v_email   TEXT := 'guilherme.sampaio@live.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      v_email,
      crypt('Jifg181020', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Guilherme Sampaio"}'::jsonb,
      FALSE, NOW(), NOW()
    );

    -- Identity record (GoTrue v2 schema)
    INSERT INTO auth.identities (
      id, user_id, provider, provider_id,
      identity_data, created_at, updated_at, last_sign_in_at
    ) VALUES (
      v_email,           -- id = email for email provider
      v_user_id,
      'email',
      v_email,
      json_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true)::jsonb,
      NOW(), NOW(), NOW()
    );

    -- CRM users entry
    INSERT INTO crm_users (id, email, display_name, role, is_active, created_at)
    VALUES (v_user_id, v_email, 'Guilherme Sampaio', 'admin', TRUE, NOW())
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Usuário criado: % (id: %)', v_email, v_user_id;
  ELSE
    -- Make sure email is confirmed even if user already exists
    UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()) WHERE id = v_user_id;
    RAISE NOTICE 'Usuário já existe: % (id: %)', v_email, v_user_id;
  END IF;
END $$;
