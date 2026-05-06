-- Row Level Security policies

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Contacts: users can only access their own
CREATE POLICY contacts_select ON contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY contacts_update ON contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY contacts_delete ON contacts FOR DELETE USING (auth.uid() = user_id);

-- Deals
CREATE POLICY deals_select ON deals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY deals_insert ON deals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY deals_update ON deals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY deals_delete ON deals FOR DELETE USING (auth.uid() = user_id);

-- Activities
CREATE POLICY activities_select ON activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY activities_insert ON activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY activities_update ON activities FOR UPDATE USING (auth.uid() = user_id);
