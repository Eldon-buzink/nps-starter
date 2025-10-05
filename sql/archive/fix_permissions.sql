-- Fix Database Permissions
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON nps_raw;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON nps_response;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON nps_ai_enrichment;

-- Disable RLS temporarily to fix permissions
ALTER TABLE nps_raw DISABLE ROW LEVEL SECURITY;
ALTER TABLE nps_response DISABLE ROW LEVEL SECURITY;
ALTER TABLE nps_ai_enrichment DISABLE ROW LEVEL SECURITY;

-- Grant explicit permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Grant permissions to authenticated users
GRANT ALL ON nps_raw TO authenticated;
GRANT ALL ON nps_response TO authenticated;
GRANT ALL ON nps_ai_enrichment TO authenticated;

-- Grant permissions to anon users (for public access)
GRANT ALL ON nps_raw TO anon;
GRANT ALL ON nps_response TO anon;
GRANT ALL ON nps_ai_enrichment TO anon;

-- Re-enable RLS with permissive policies
ALTER TABLE nps_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_ai_enrichment ENABLE ROW LEVEL SECURITY;

-- Create permissive RLS policies
CREATE POLICY "Allow all for authenticated users" ON nps_raw
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON nps_response
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON nps_ai_enrichment
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also allow anon access for development
CREATE POLICY "Allow all for anon users" ON nps_raw
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon users" ON nps_response
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon users" ON nps_ai_enrichment
    FOR ALL TO anon USING (true) WITH CHECK (true);
