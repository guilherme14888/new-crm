-- Migration 006: Add CNPJ to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18) DEFAULT NULL AFTER plan;
