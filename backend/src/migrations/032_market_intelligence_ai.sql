-- Migration 032: provedor de IA por tenant (escolhido na UI das Configurações).
--   Cada empresa pode escolher o provedor (Anthropic, OpenAI, Gemini, Grok,
--   DeepSeek), a chave e (opcional) o modelo. É usado para classificar licitações
--   por contexto (relevância) e para sugerir contexto/exclusões de palavras-chave.
--   Sem registro aqui, o sistema cai no fallback por variável de ambiente.

CREATE TABLE IF NOT EXISTS market_intelligence_ai (
  company_id VARCHAR(36) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
  provider   VARCHAR(20) NOT NULL DEFAULT 'anthropic',  -- anthropic|openai|gemini|grok|deepseek
  api_key    TEXT NULL,                                 -- chave do provedor (sensível)
  model      VARCHAR(80) NULL,                          -- opcional; default por provedor
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;
