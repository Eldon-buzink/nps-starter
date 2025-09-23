-- Minimal NPS Database Setup
-- This creates the essential tables needed for the frontend to work
-- Run this in Supabase SQL Editor

-- ==============================================
-- 1. DROP EXISTING OBJECTS
-- ==============================================

-- Drop everything in the correct order
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- ==============================================
-- 2. ENABLE EXTENSIONS
-- ==============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- 3. CREATE CORE TABLES
-- ==============================================

-- Raw data table (for CSV imports)
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
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processed responses table
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
    nps_category VARCHAR(20) CHECK (nps_category IN ('detractor', 'passive', 'promoter')),
    word_count INTEGER,
    has_explanation BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI enrichment table
CREATE TABLE nps_ai_enrichment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID REFERENCES nps_response(id) ON DELETE CASCADE,
    sentiment DECIMAL(3,2) CHECK (sentiment >= -1 AND sentiment <= 1),
    themes TEXT[],
    theme_scores JSONB,
    extracted_keywords TEXT[],
    language VARCHAR(10) DEFAULT 'nl',
    promoter_flag BOOLEAN DEFAULT FALSE,
    passive_flag BOOLEAN DEFAULT FALSE,
    detractor_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- ==============================================
-- 5. CREATE BASIC VIEWS
-- ==============================================

-- Summary view for dashboard
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

-- ==============================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ==============================================

ALTER TABLE nps_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_ai_enrichment ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations for authenticated users" ON nps_raw
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON nps_response
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON nps_ai_enrichment
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================
-- 7. INSERT SAMPLE DATA
-- ==============================================

-- Insert sample data
INSERT INTO nps_raw (survey_name, nps_score, nps_explanation, gender, age_range, years_employed, creation_date, title_text, raw_data)
VALUES 
('LLT_Nieuws', 9, 'Excellent service, very satisfied with the quality of the newspaper. The articles are always interesting and well written.', 'Female', '35-44', '5-10', '2025-09-20', 'Trouw', '{"original_comment": "Excellent service"}'),
('LLT_Nieuws', 4, 'Too expensive for what you get. Also many technical problems with the app.', 'Male', '25-34', '1-3', '2025-09-19', 'Volkskrant', '{"original_comment": "Too expensive"}'),
('LLT_Nieuws', 7, 'Reasonably satisfied, interface could be more user-friendly.', 'Female', '45-54', '10+', '2025-09-18', 'NRC', '{"original_comment": "Reasonably satisfied"}'),
('LLT_Nieuws', 8, 'Good newspaper, but could improve digital experience.', 'Male', '35-44', '3-5', '2025-09-17', 'Trouw', '{"original_comment": "Good newspaper"}'),
('LLT_Nieuws', 6, 'Average quality, nothing special.', 'Female', '25-34', '1-3', '2025-09-16', 'Volkskrant', '{"original_comment": "Average quality"}');

-- Insert processed responses
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
FROM nps_raw;

-- Insert AI enrichment data
INSERT INTO nps_ai_enrichment (response_id, sentiment, themes, theme_scores, extracted_keywords, language, promoter_flag, passive_flag, detractor_flag)
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
    r.nps_score <= 6 as detractor_flag
FROM nps_response r;

COMMIT;
