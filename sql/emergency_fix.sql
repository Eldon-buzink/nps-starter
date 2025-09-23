-- Emergency Database Fix
-- This script completely disables RLS and grants all permissions
-- Run this in Supabase SQL Editor

-- Disable RLS on all tables
ALTER TABLE IF EXISTS nps_raw DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nps_response DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nps_ai_enrichment DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON nps_raw;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON nps_response;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON nps_ai_enrichment;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON nps_raw;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON nps_response;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON nps_ai_enrichment;
DROP POLICY IF EXISTS "Allow all for anon users" ON nps_raw;
DROP POLICY IF EXISTS "Allow all for anon users" ON nps_response;
DROP POLICY IF EXISTS "Allow all for anon users" ON nps_ai_enrichment;

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

-- Grant specific table permissions
GRANT ALL ON nps_raw TO postgres, authenticated, anon;
GRANT ALL ON nps_response TO postgres, authenticated, anon;
GRANT ALL ON nps_ai_enrichment TO postgres, authenticated, anon;

-- Grant permissions on views
GRANT ALL ON nps_summary TO postgres, authenticated, anon;

-- Make sure the tables exist and are accessible
SELECT 'nps_raw' as table_name, count(*) as row_count FROM nps_raw
UNION ALL
SELECT 'nps_response' as table_name, count(*) as row_count FROM nps_response
UNION ALL
SELECT 'nps_ai_enrichment' as table_name, count(*) as row_count FROM nps_ai_enrichment;
