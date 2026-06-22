-- Migration 040: atribuição de Tenants (empresas) por Equipe.
-- Equipes vivem na empresa Default (00..01). Cada equipe pode ser atribuída a um ou
-- mais tenants (empresas-filhas). Usuários da Default que pertencem à equipe passam a
-- enxergar SOMENTE os dados desses tenants (em vez de TODAS as empresas).
CREATE TABLE IF NOT EXISTS team_tenants (
  team_id    VARCHAR(36) NOT NULL,
  company_id VARCHAR(36) NOT NULL,            -- tenant que a equipe visualiza
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, company_id),
  INDEX idx_tt_team (team_id),
  INDEX idx_tt_company (company_id)
);
