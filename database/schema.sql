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
