-- ─── Migration 005: Anon access (GoTrue email auth disabled) ─────────────────
-- Run this in: Supabase Dashboard > SQL Editor
-- Allows the app to read/write without a Supabase JWT session.
-- This is appropriate for a self-hosted internal CRM.

-- ─── Make user_id nullable (no FK violation on anon inserts) ─────────────────
ALTER TABLE contacts   ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE deals      ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE activities ALTER COLUMN user_id DROP NOT NULL;

-- ─── Replace all policies with anon + authenticated access ───────────────────
-- Contacts
DROP POLICY IF EXISTS contacts_all ON contacts;
CREATE POLICY contacts_all ON contacts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Deals
DROP POLICY IF EXISTS deals_all ON deals;
CREATE POLICY deals_all ON deals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Activities
DROP POLICY IF EXISTS activities_all ON activities;
CREATE POLICY activities_all ON activities FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Funnels
DROP POLICY IF EXISTS funnels_all ON funnels;
CREATE POLICY funnels_all ON funnels FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Funnel stages
DROP POLICY IF EXISTS funnel_stages_all ON funnel_stages;
CREATE POLICY funnel_stages_all ON funnel_stages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Opportunity rules
DROP POLICY IF EXISTS opportunity_rules_all ON opportunity_rules;
CREATE POLICY opportunity_rules_all ON opportunity_rules FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Win/loss reasons
DROP POLICY IF EXISTS win_loss_reasons_all ON win_loss_reasons;
CREATE POLICY win_loss_reasons_all ON win_loss_reasons FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- CRM users
DROP POLICY IF EXISTS crm_users_select ON crm_users;
DROP POLICY IF EXISTS crm_users_write  ON crm_users;
CREATE POLICY crm_users_all ON crm_users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Grant usage on public schema to anon role
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
