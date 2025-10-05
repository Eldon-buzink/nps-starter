-- Simple Database Setup - No pgvector dependency
-- Run this script in your Supabase SQL Editor

-- ==============================================
-- 1. DROP EXISTING OBJECTS (if they exist)
-- ==============================================

-- Drop functions first (they depend on tables/views)
-- Use CASCADE to drop dependent objects
DROP FUNCTION IF EXISTS top_title_mom_moves(date, date, text, int, int) CASCADE;
DROP FUNCTION IF EXISTS title_theme_share_mom(text, text) CASCADE;
DROP FUNCTION IF EXISTS nps_trend_by_title_with_mom(date, date, text, text) CASCADE;
DROP FUNCTION IF EXISTS nps_trend_by_title(date, date, text, text) CASCADE;
DROP FUNCTION IF EXISTS themes_promoter_detractor(date, date, text, text) CASCADE;
DROP FUNCTION IF EXISTS themes_aggregate(date, date, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS similar_responses_by_vector(text, int) CASCADE;
DROP FUNCTION IF EXISTS similar_responses_for_response(uuid, int) CASCADE;

-- Drop views (they depend on functions)
DROP VIEW IF EXISTS v_nps_response_themes CASCADE;
DROP VIEW IF EXISTS v_nps_monthly CASCADE;
DROP VIEW IF EXISTS nps_summary CASCADE;
DROP VIEW IF EXISTS nps_survey_metrics CASCADE;
DROP VIEW IF EXISTS nps_daily_trends CASCADE;
DROP VIEW IF EXISTS nps_theme_analysis CASCADE;
DROP VIEW IF EXISTS nps_demographics CASCADE;
DROP VIEW IF EXISTS nps_recent_responses CASCADE;

-- Now drop the helper functions
DROP FUNCTION IF EXISTS calculate_nps_score(bigint, bigint, bigint) CASCADE;
DROP FUNCTION IF EXISTS categorize_nps_score(integer) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS nps_daily_rollup CASCADE;
DROP TABLE IF EXISTS nps_ai_enrichment CASCADE;
DROP TABLE IF EXISTS nps_response CASCADE;
DROP TABLE IF EXISTS nps_raw CASCADE;

-- ==============================================
-- 2. CREATE FRESH SCHEMA
-- ==============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create raw data table for initial CSV imports
CREATE TABLE nps_raw (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_name VARCHAR(255) NOT NULL,
    nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
    nps_explanation TEXT,
    gender VARCHAR(50),
    age_range VARCHAR(50),
    years_employed VARCHAR(50),
    creation_date DATE,
    title_text VARCHAR(255),
    raw_data JSONB, -- Store original CSV row data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create processed responses table
CREATE TABLE nps_response (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_id UUID REFERENCES nps_raw(id) ON DELETE CASCADE,
    survey_name VARCHAR(255) NOT NULL,
    nps_score INTEGER NOT NULL CHECK (nps_score >= 0 AND nps_score <= 10),
    nps_explanation TEXT,
    gender VARCHAR(50),
    age_range VARCHAR(50),
    years_employed VARCHAR(50),
    creation_date DATE,
    title_text VARCHAR(255),
    -- NPS categorization
    nps_category VARCHAR(20) CHECK (nps_category IN ('detractor', 'passive', 'promoter')),
    -- Processed metadata
    word_count INTEGER,
    has_explanation BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI enrichment table (without vector for now)
CREATE TABLE nps_ai_enrichment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID REFERENCES nps_response(id) ON DELETE CASCADE,
    sentiment DECIMAL(3,2) CHECK (sentiment >= -1 AND sentiment <= 1),
    themes TEXT[],
    theme_scores JSONB,
    extracted_keywords TEXT[],
    language VARCHAR(10) DEFAULT 'nl',
    embedded_vector TEXT, -- Store as JSON text until pgvector is enabled
    promoter_flag BOOLEAN DEFAULT FALSE,
    passive_flag BOOLEAN DEFAULT FALSE,
    detractor_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily rollup table for performance
CREATE TABLE nps_daily_rollup (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_name VARCHAR(255) NOT NULL,
    rollup_date DATE NOT NULL,
    total_responses INTEGER DEFAULT 0,
    promoters INTEGER DEFAULT 0,
    passives INTEGER DEFAULT 0,
    detractors INTEGER DEFAULT 0,
    nps_score DECIMAL(5,2) DEFAULT 0,
    average_score DECIMAL(3,1) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(survey_name, rollup_date)
);

-- ==============================================
-- 3. CREATE INDEXES
-- ==============================================

-- Basic indexes
CREATE INDEX idx_nps_raw_survey ON nps_raw(survey_name);
CREATE INDEX idx_nps_raw_date ON nps_raw(creation_date);
CREATE INDEX idx_nps_response_survey ON nps_response(survey_name);
CREATE INDEX idx_nps_response_date ON nps_response(creation_date);
CREATE INDEX idx_nps_response_score ON nps_response(nps_score);
CREATE INDEX idx_nps_daily_rollup_survey_date ON nps_daily_rollup(survey_name, rollup_date);

-- ==============================================
-- 4. CREATE HELPER FUNCTIONS
-- ==============================================

-- Function to categorize NPS score
CREATE OR REPLACE FUNCTION categorize_nps_score(score INTEGER)
RETURNS VARCHAR(20) AS $$
BEGIN
    IF score >= 9 THEN
        RETURN 'promoter';
    ELSIF score >= 7 THEN
        RETURN 'passive';
    ELSE
        RETURN 'detractor';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate NPS score
CREATE OR REPLACE FUNCTION calculate_nps_score(promoters BIGINT, detractors BIGINT, total BIGINT)
RETURNS DECIMAL(5,2) AS $$
BEGIN
    IF total = 0 THEN
        RETURN 0;
    END IF;
    RETURN ROUND(((promoters::DECIMAL / total) - (detractors::DECIMAL / total)) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 5. CREATE TRIGGERS
-- ==============================================

-- Trigger for nps_raw
CREATE TRIGGER update_nps_raw_updated_at
    BEFORE UPDATE ON nps_raw
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for nps_response
CREATE TRIGGER update_nps_response_updated_at
    BEFORE UPDATE ON nps_response
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for nps_ai_enrichment
CREATE TRIGGER update_nps_ai_enrichment_updated_at
    BEFORE UPDATE ON nps_ai_enrichment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for nps_daily_rollup
CREATE TRIGGER update_nps_daily_rollup_updated_at
    BEFORE UPDATE ON nps_daily_rollup
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- 6. CREATE VIEWS
-- ==============================================

-- Summary view
CREATE VIEW nps_summary AS
SELECT
    survey_name,
    COUNT(*) as total_responses,
    COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END) as promoters,
    COUNT(CASE WHEN nps_category = 'passive' THEN 1 END) as passives,
    COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END) as detractors,
    ROUND(AVG(nps_score), 2) as average_score,
    calculate_nps_score(
        COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END)::BIGINT,
        COUNT(*)::BIGINT
    ) as nps_score,
    MIN(creation_date) as first_response,
    MAX(creation_date) as last_response
FROM nps_response
GROUP BY survey_name;

-- NPS metrics by survey
CREATE VIEW nps_survey_metrics AS
SELECT
    survey_name,
    COUNT(*) as total_responses,
    COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END) as promoters,
    COUNT(CASE WHEN nps_category = 'passive' THEN 1 END) as passives,
    COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END) as detractors,
    ROUND(AVG(nps_score), 2) as average_score,
    calculate_nps_score(
        COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END)::BIGINT,
        COUNT(*)::BIGINT
    ) as nps_score,
    MIN(creation_date) as first_response,
    MAX(creation_date) as last_response
FROM nps_response
GROUP BY survey_name;

-- Daily trends view
CREATE VIEW nps_daily_trends AS
SELECT
    survey_name,
    creation_date,
    COUNT(*) as responses,
    calculate_nps_score(
        COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END)::BIGINT,
        COUNT(*)::BIGINT
    ) as nps_score
FROM nps_response
GROUP BY survey_name, creation_date
ORDER BY survey_name, creation_date;

-- Theme analysis view
CREATE VIEW nps_theme_analysis AS
SELECT
    survey_name,
    theme,
    COUNT(*) as theme_count,
    ROUND(AVG(nps_score), 2) as avg_nps_score,
    calculate_nps_score(
        COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END)::BIGINT,
        COUNT(*)::BIGINT
    ) as nps_score
FROM nps_response r
JOIN nps_ai_enrichment e ON e.response_id = r.id
CROSS JOIN LATERAL unnest(e.themes) as theme
GROUP BY survey_name, theme
ORDER BY survey_name, theme_count DESC;

-- Demographics view
CREATE VIEW nps_demographics AS
SELECT
    survey_name,
    gender,
    age_range,
    years_employed,
    COUNT(*) as response_count,
    ROUND(AVG(nps_score), 2) as avg_nps_score,
    calculate_nps_score(
        COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END)::BIGINT,
        COUNT(*)::BIGINT
    ) as nps_score
FROM nps_response
GROUP BY survey_name, gender, age_range, years_employed
ORDER BY survey_name, response_count DESC;

-- Recent responses view
CREATE VIEW nps_recent_responses AS
SELECT
    r.id,
    r.survey_name,
    r.nps_score,
    r.nps_category,
    r.title_text,
    r.creation_date,
    r.nps_explanation,
    e.sentiment,
    e.themes,
    e.extracted_keywords
FROM nps_response r
LEFT JOIN nps_ai_enrichment e ON e.response_id = r.id
ORDER BY r.creation_date DESC, r.created_at DESC
LIMIT 100;

-- ==============================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE nps_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_ai_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_daily_rollup ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON nps_raw
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON nps_response
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON nps_ai_enrichment
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON nps_daily_rollup
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================
-- 8. INSERT SAMPLE DATA
-- ==============================================

-- Insert sample raw data
INSERT INTO nps_raw (survey_name, nps_score, nps_explanation, gender, age_range, years_employed, creation_date, title_text, raw_data)
VALUES 
('LLT_Nieuws', 9, 'Excellent service, very satisfied with the quality of the newspaper. The articles are always interesting and well written.', 'Female', '35-44', '5-10', '2025-09-20', 'Trouw', '{"original_comment": "Excellent service"}'),
('LLT_Nieuws', 4, 'Too expensive for what you get. Also many technical problems with the app.', 'Male', '25-34', '1-3', '2025-09-19', 'Volkskrant', '{"original_comment": "Too expensive"}'),
('LLT_Nieuws', 7, 'Reasonably satisfied, interface could be more user-friendly.', 'Female', '45-54', '10+', '2025-09-18', 'NRC', '{"original_comment": "Reasonably satisfied"}');

-- Insert sample processed responses
INSERT INTO nps_response (raw_id, survey_name, nps_score, nps_explanation, gender, age_range, years_employed, creation_date, title_text, nps_category, word_count, has_explanation)
SELECT 
    id,
    survey_name,
    nps_score,
    nps_explanation,
    gender,
    age_range,
    years_employed,
    creation_date,
    title_text,
    categorize_nps_score(nps_score),
    CASE WHEN nps_explanation IS NOT NULL THEN array_length(string_to_array(nps_explanation, ' '), 1) ELSE 0 END,
    CASE WHEN nps_explanation IS NOT NULL AND nps_explanation != '' THEN true ELSE false END
FROM nps_raw
WHERE survey_name = 'LLT_Nieuws';

-- Insert sample AI enrichment data
INSERT INTO nps_ai_enrichment (response_id, sentiment, themes, theme_scores, extracted_keywords, language, promoter_flag, passive_flag, detractor_flag, embedded_vector)
SELECT 
    r.id,
    CASE 
        WHEN r.nps_score >= 9 THEN 0.8
        WHEN r.nps_score >= 7 THEN 0.2
        ELSE -0.3
    END as sentiment,
    CASE 
        WHEN r.nps_score >= 9 THEN ARRAY['klantenservice', 'content_kwaliteit']
        WHEN r.nps_score >= 7 THEN ARRAY['app_ux']
        ELSE ARRAY['pricing', 'app_ux']
    END as themes,
    CASE 
        WHEN r.nps_score >= 9 THEN '{"klantenservice": 0.8, "content_kwaliteit": 0.7}'::jsonb
        WHEN r.nps_score >= 7 THEN '{"app_ux": 0.6}'::jsonb
        ELSE '{"pricing": 0.9, "app_ux": 0.5}'::jsonb
    END as theme_scores,
    CASE 
        WHEN r.nps_score >= 9 THEN ARRAY['excellent', 'service', 'quality', 'articles']
        WHEN r.nps_score >= 7 THEN ARRAY['satisfied', 'interface', 'user-friendly']
        ELSE ARRAY['expensive', 'technical', 'problems', 'app']
    END as extracted_keywords,
    'nl' as language,
    r.nps_score >= 9 as promoter_flag,
    r.nps_score BETWEEN 7 AND 8 as passive_flag,
    r.nps_score <= 6 as detractor_flag,
    '[]' as embedded_vector -- Empty JSON array as placeholder
FROM nps_response r
WHERE r.survey_name = 'LLT_Nieuws';

COMMIT;
