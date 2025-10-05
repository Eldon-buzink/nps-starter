-- Final Database Fix
-- This script ensures all permissions are properly set
-- Run this in Supabase SQL Editor

-- First, let's check what's currently in the database
SELECT 'Current state:' as status;
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Disable RLS completely
ALTER TABLE IF EXISTS nps_raw DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nps_response DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nps_ai_enrichment DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON ' || r.schemaname || '.' || r.tablename;
        EXECUTE 'DROP POLICY IF EXISTS "Allow all for authenticated users" ON ' || r.schemaname || '.' || r.tablename;
        EXECUTE 'DROP POLICY IF EXISTS "Allow all for anon users" ON ' || r.schemaname || '.' || r.tablename;
    END LOOP;
END $$;

-- Grant ALL permissions to everyone
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Grant specific permissions on each table
GRANT ALL ON nps_raw TO postgres, authenticated, anon, service_role;
GRANT ALL ON nps_response TO postgres, authenticated, anon, service_role;
GRANT ALL ON nps_ai_enrichment TO postgres, authenticated, anon, service_role;

-- Grant permissions on views
GRANT ALL ON nps_summary TO postgres, authenticated, anon, service_role;

-- Test that we can access the tables
SELECT 'Testing access:' as status;
SELECT 'nps_raw' as table_name, count(*) as row_count FROM nps_raw
UNION ALL
SELECT 'nps_response' as table_name, count(*) as row_count FROM nps_response
UNION ALL
SELECT 'nps_ai_enrichment' as table_name, count(*) as row_count FROM nps_ai_enrichment;

-- Show current permissions
SELECT 'Current permissions:' as status;
SELECT grantee, privilege_type, table_name 
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
AND table_name IN ('nps_raw', 'nps_response', 'nps_ai_enrichment')
ORDER BY table_name, grantee;
