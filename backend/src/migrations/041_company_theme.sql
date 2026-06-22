-- Migration 041: tema (cores) por empresa/tenant. JSON com as cores customizáveis:
--   { "sidebarBg": "#0f172a", "sidebarText": "#ffffff", "primary": "#3b82f6" }
-- Null = usa o tema padrão do sistema. Cada tenant pode personalizar sua interface.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS theme TEXT NULL;
