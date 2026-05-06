// ─── Existing tables ───────────────────────────────────────────────────────────
export const CREATE_CONTACTS_TABLE = `
CREATE TABLE IF NOT EXISTS contacts (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL DEFAULT 'lead',
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  company       TEXT,
  job_title     TEXT,
  avatar_url    TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',
  notes         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  sync_status   TEXT NOT NULL DEFAULT 'pending_push',
  deleted_at    TEXT
);`;

export const CREATE_DEALS_TABLE = `
CREATE TABLE IF NOT EXISTS deals (
  id                  TEXT PRIMARY KEY,
  funnel_id           TEXT NOT NULL DEFAULT 'default',
  stage_id            TEXT NOT NULL DEFAULT '',
  contact_id          TEXT NOT NULL REFERENCES contacts(id),
  owner_id            TEXT,
  title               TEXT NOT NULL,
  value               INTEGER NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'BRL',
  stage               TEXT NOT NULL DEFAULT 'qualification',
  stage_order         REAL NOT NULL DEFAULT 0,
  probability         INTEGER NOT NULL DEFAULT 10,
  expected_close_date TEXT,
  closing_reason      TEXT,
  notes               TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  sync_status         TEXT NOT NULL DEFAULT 'pending_push',
  deleted_at          TEXT
);`;

export const CREATE_ACTIVITIES_TABLE = `
CREATE TABLE IF NOT EXISTS activities (
  id          TEXT PRIMARY KEY,
  deal_id     TEXT REFERENCES deals(id),
  contact_id  TEXT NOT NULL REFERENCES contacts(id),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  occurred_at TEXT NOT NULL,
  metadata    TEXT,
  created_at  TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending_push'
);`;

export const CREATE_SYNC_META_TABLE = `
CREATE TABLE IF NOT EXISTS sync_meta (
  table_name     TEXT PRIMARY KEY,
  last_pulled_at TEXT
);`;

// ─── Funnel tables ─────────────────────────────────────────────────────────────
export const CREATE_FUNNELS_TABLE = `
CREATE TABLE IF NOT EXISTS funnels (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  is_default  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);`;

export const CREATE_FUNNEL_STAGES_TABLE = `
CREATE TABLE IF NOT EXISTS funnel_stages (
  id          TEXT PRIMARY KEY,
  funnel_id   TEXT NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#94a3b8',
  stage_order INTEGER NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 10,
  type        TEXT NOT NULL DEFAULT 'active',
  rotten_days INTEGER,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);`;

// ─── Opportunity rules ─────────────────────────────────────────────────────────
export const CREATE_OPPORTUNITY_RULES_TABLE = `
CREATE TABLE IF NOT EXISTS opportunity_rules (
  id             TEXT PRIMARY KEY,
  funnel_id      TEXT NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  trigger        TEXT NOT NULL,
  trigger_config TEXT NOT NULL DEFAULT '{}',
  action         TEXT NOT NULL,
  action_config  TEXT NOT NULL DEFAULT '{}',
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);`;

// ─── Win / loss reasons ────────────────────────────────────────────────────────
export const CREATE_WIN_LOSS_REASONS_TABLE = `
CREATE TABLE IF NOT EXISTS win_loss_reasons (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  label      TEXT NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);`;

// ─── CRM users (mirror of auth.users for frontend management) ──────────────────
export const CREATE_CRM_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS crm_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);`;

// ─── Migrations ────────────────────────────────────────────────────────────────
export const ALTER_DEALS_ADD_FUNNEL_COLUMNS = `
-- no-op on re-run, wrapped in try in runMigrations
`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage) WHERE deleted_at IS NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_deals_funnel ON deals(funnel_id) WHERE deleted_at IS NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON deals(stage_id) WHERE deleted_at IS NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type) WHERE deleted_at IS NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_id);`,
  `CREATE INDEX IF NOT EXISTS idx_activities_deal ON activities(deal_id);`,
  `CREATE INDEX IF NOT EXISTS idx_funnel_stages_funnel ON funnel_stages(funnel_id);`,
  `CREATE INDEX IF NOT EXISTS idx_opportunity_rules_funnel ON opportunity_rules(funnel_id);`,
];

export const ALL_SCHEMA_STATEMENTS = [
  CREATE_CONTACTS_TABLE,
  CREATE_DEALS_TABLE,
  CREATE_ACTIVITIES_TABLE,
  CREATE_SYNC_META_TABLE,
  CREATE_FUNNELS_TABLE,
  CREATE_FUNNEL_STAGES_TABLE,
  CREATE_OPPORTUNITY_RULES_TABLE,
  CREATE_WIN_LOSS_REASONS_TABLE,
  CREATE_CRM_USERS_TABLE,
  ...CREATE_INDEXES,
];

// ─── Seed data: default funnel ─────────────────────────────────────────────────
export const DEFAULT_FUNNEL_ID = 'default-funnel';

export const SEED_DEFAULT_FUNNEL = `
INSERT OR IGNORE INTO funnels (id, name, description, is_default, is_active, created_at, updated_at)
VALUES ('${DEFAULT_FUNNEL_ID}', 'Pipeline Principal', 'Funil padrão do CRM', 1, 1,
  datetime('now'), datetime('now'));`;

export const SEED_DEFAULT_STAGES = [
  `INSERT OR IGNORE INTO funnel_stages (id, funnel_id, name, color, stage_order, probability, type, created_at, updated_at) VALUES ('${DEFAULT_FUNNEL_ID}-s1', '${DEFAULT_FUNNEL_ID}', 'Qualificação',  '#94a3b8', 0, 10,  'active', datetime('now'), datetime('now'));`,
  `INSERT OR IGNORE INTO funnel_stages (id, funnel_id, name, color, stage_order, probability, type, created_at, updated_at) VALUES ('${DEFAULT_FUNNEL_ID}-s2', '${DEFAULT_FUNNEL_ID}', 'Descoberta',   '#3b82f6', 1, 25,  'active', datetime('now'), datetime('now'));`,
  `INSERT OR IGNORE INTO funnel_stages (id, funnel_id, name, color, stage_order, probability, type, created_at, updated_at) VALUES ('${DEFAULT_FUNNEL_ID}-s3', '${DEFAULT_FUNNEL_ID}', 'Proposta',     '#f59e0b', 2, 50,  'active', datetime('now'), datetime('now'));`,
  `INSERT OR IGNORE INTO funnel_stages (id, funnel_id, name, color, stage_order, probability, type, created_at, updated_at) VALUES ('${DEFAULT_FUNNEL_ID}-s4', '${DEFAULT_FUNNEL_ID}', 'Negociação',   '#f97316', 3, 75,  'active', datetime('now'), datetime('now'));`,
  `INSERT OR IGNORE INTO funnel_stages (id, funnel_id, name, color, stage_order, probability, type, created_at, updated_at) VALUES ('${DEFAULT_FUNNEL_ID}-s5', '${DEFAULT_FUNNEL_ID}', 'Ganho',        '#16a34a', 4, 100, 'won',    datetime('now'), datetime('now'));`,
  `INSERT OR IGNORE INTO funnel_stages (id, funnel_id, name, color, stage_order, probability, type, created_at, updated_at) VALUES ('${DEFAULT_FUNNEL_ID}-s6', '${DEFAULT_FUNNEL_ID}', 'Perdido',      '#ef4444', 5, 0,   'lost',   datetime('now'), datetime('now'));`,
];

export const SEED_WIN_LOSS_REASONS = [
  `INSERT OR IGNORE INTO win_loss_reasons (id, type, label, is_active, created_at) VALUES ('wl-w1', 'won',  'Melhor preço',           1, datetime('now'));`,
  `INSERT OR IGNORE INTO win_loss_reasons (id, type, label, is_active, created_at) VALUES ('wl-w2', 'won',  'Melhor produto',         1, datetime('now'));`,
  `INSERT OR IGNORE INTO win_loss_reasons (id, type, label, is_active, created_at) VALUES ('wl-w3', 'won',  'Relacionamento',         1, datetime('now'));`,
  `INSERT OR IGNORE INTO win_loss_reasons (id, type, label, is_active, created_at) VALUES ('wl-l1', 'lost', 'Preço alto',             1, datetime('now'));`,
  `INSERT OR IGNORE INTO win_loss_reasons (id, type, label, is_active, created_at) VALUES ('wl-l2', 'lost', 'Escolheu concorrente',   1, datetime('now'));`,
  `INSERT OR IGNORE INTO win_loss_reasons (id, type, label, is_active, created_at) VALUES ('wl-l3', 'lost', 'Sem budget',             1, datetime('now'));`,
  `INSERT OR IGNORE INTO win_loss_reasons (id, type, label, is_active, created_at) VALUES ('wl-l4', 'lost', 'Projeto cancelado',      1, datetime('now'));`,
  `INSERT OR IGNORE INTO win_loss_reasons (id, type, label, is_active, created_at) VALUES ('wl-l5', 'lost', 'Sem resposta',           1, datetime('now'));`,
];

export const ALL_SEED_STATEMENTS = [
  SEED_DEFAULT_FUNNEL,
  ...SEED_DEFAULT_STAGES,
  ...SEED_WIN_LOSS_REASONS,
];
