-- Migration 007: Fix funnel_stages.company_id to match parent funnel
-- Ensures every stage is scoped to the correct tenant
UPDATE funnel_stages fs
  JOIN funnels f ON f.id = fs.funnel_id
  SET fs.company_id = f.company_id
  WHERE fs.company_id = '00000000-0000-0000-0000-000000000001'
    AND f.company_id != '00000000-0000-0000-0000-000000000001';
