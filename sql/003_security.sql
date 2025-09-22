-- Row Level Security (RLS) Setup
-- This file contains security policies for the NPS tool

-- Enable RLS on all tables
ALTER TABLE nps_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_ai_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_daily_rollup ENABLE ROW LEVEL SECURITY;

-- Create roles
-- Note: In production, you would create these roles in Supabase dashboard
-- or through your authentication system

-- Admin role - full access
CREATE ROLE nps_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO nps_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO nps_admin;

-- Analyst role - read access to processed data
CREATE ROLE nps_analyst;
GRANT SELECT ON nps_response TO nps_analyst;
GRANT SELECT ON nps_ai_enrichment TO nps_analyst;
GRANT SELECT ON nps_daily_rollup TO nps_analyst;
GRANT SELECT ON ALL VIEWS IN SCHEMA public TO nps_analyst;

-- Data processor role - can insert/update raw data and process responses
CREATE ROLE nps_processor;
GRANT SELECT, INSERT, UPDATE ON nps_raw TO nps_processor;
GRANT SELECT, INSERT, UPDATE ON nps_response TO nps_processor;
GRANT SELECT, INSERT, UPDATE ON nps_ai_enrichment TO nps_processor;
GRANT SELECT ON nps_daily_rollup TO nps_processor;

-- Public role - limited read access
CREATE ROLE nps_public;
GRANT SELECT ON nps_survey_metrics TO nps_public;
GRANT SELECT ON nps_daily_trends TO nps_public;

-- RLS Policies

-- nps_raw table policies
CREATE POLICY "Admins can do everything on nps_raw" ON nps_raw
    FOR ALL TO nps_admin USING (true);

CREATE POLICY "Processors can insert and update nps_raw" ON nps_raw
    FOR ALL TO nps_processor USING (true);

CREATE POLICY "Analysts can read nps_raw" ON nps_raw
    FOR SELECT TO nps_analyst USING (true);

-- nps_response table policies
CREATE POLICY "Admins can do everything on nps_response" ON nps_response
    FOR ALL TO nps_admin USING (true);

CREATE POLICY "Processors can insert and update nps_response" ON nps_response
    FOR ALL TO nps_processor USING (true);

CREATE POLICY "Analysts can read nps_response" ON nps_response
    FOR SELECT TO nps_analyst USING (true);

-- nps_ai_enrichment table policies
CREATE POLICY "Admins can do everything on nps_ai_enrichment" ON nps_ai_enrichment
    FOR ALL TO nps_admin USING (true);

CREATE POLICY "Processors can insert and update nps_ai_enrichment" ON nps_ai_enrichment
    FOR ALL TO nps_processor USING (true);

CREATE POLICY "Analysts can read nps_ai_enrichment" ON nps_ai_enrichment
    FOR SELECT TO nps_analyst USING (true);

-- nps_daily_rollup table policies
CREATE POLICY "Admins can do everything on nps_daily_rollup" ON nps_daily_rollup
    FOR ALL TO nps_admin USING (true);

CREATE POLICY "Processors can read nps_daily_rollup" ON nps_daily_rollup
    FOR SELECT TO nps_processor USING (true);

CREATE POLICY "Analysts can read nps_daily_rollup" ON nps_daily_rollup
    FOR SELECT TO nps_analyst USING (true);

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO nps_admin, nps_analyst, nps_processor, nps_public;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION categorize_nps_score(INTEGER) TO nps_admin, nps_processor;
GRANT EXECUTE ON FUNCTION calculate_nps_score(INTEGER, INTEGER, INTEGER) TO nps_admin, nps_analyst, nps_processor, nps_public;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO nps_admin, nps_processor;

-- Create a function to check if user has admin role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('role') = 'nps_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user has analyst role
CREATE OR REPLACE FUNCTION is_analyst()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('role') IN ('nps_admin', 'nps_analyst');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user has processor role
CREATE OR REPLACE FUNCTION is_processor()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('role') IN ('nps_admin', 'nps_processor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
