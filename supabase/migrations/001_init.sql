-- CRM Mobile: Supabase remote schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS contacts (
  id            UUID PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL DEFAULT 'lead',
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  company       TEXT,
  job_title     TEXT,
  avatar_url    TEXT,
  tags          JSONB NOT NULL DEFAULT '[]',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS deals (
  id                  UUID PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id          UUID NOT NULL REFERENCES contacts(id),
  title               TEXT NOT NULL,
  value               BIGINT NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'BRL',
  stage               TEXT NOT NULL DEFAULT 'qualification',
  stage_order         FLOAT NOT NULL DEFAULT 0,
  probability         INTEGER NOT NULL DEFAULT 10,
  expected_close_date DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS activities (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id     UUID REFERENCES deals(id),
  contact_id  UUID NOT NULL REFERENCES contacts(id),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_user ON contacts(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deals_user ON deals(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deals_stage ON deals(stage) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_contact ON activities(contact_id);
