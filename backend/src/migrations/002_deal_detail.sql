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
