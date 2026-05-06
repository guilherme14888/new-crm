-- Migration 008: user_companies join table for multi-company membership
CREATE TABLE IF NOT EXISTS user_companies (
  user_id    VARCHAR(36) NOT NULL,
  company_id VARCHAR(36) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, company_id),
  INDEX idx_uc_company (company_id),
  CONSTRAINT fk_uc_user    FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_uc_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed from existing users.company_id so no one loses access
INSERT IGNORE INTO user_companies (user_id, company_id)
  SELECT id, company_id FROM users WHERE company_id IS NOT NULL;
