-- Complete NPS Database Setup
-- This script fixes all database issues including permissions and ambiguous columns
-- Run this in Supabase SQL Editor

-- ==============================================
-- 1. CLEAN SLATE - DROP EVERYTHING
-- ==============================================

-- Drop all existing objects
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
    nps_category VARCHAR(20) CHECK (nps_category IN ('promoter', 'passive', 'detractor')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Enrichment table
CREATE TABLE nps_ai_enrichment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID REFERENCES nps_response(id) ON DELETE CASCADE,
    themes TEXT[],
    theme_scores JSONB,
    sentiment DECIMAL(3,2),
    extracted_keywords TEXT[],
    language VARCHAR(10) DEFAULT 'nl',
    embedded_vector TEXT,
    promoter_flag BOOLEAN DEFAULT FALSE,
    passive_flag BOOLEAN DEFAULT FALSE,
    detractor_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 4. HELPER FUNCTIONS
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate NPS score
CREATE OR REPLACE FUNCTION calculate_nps_score(promoters BIGINT, detractors BIGINT, total BIGINT)
RETURNS DECIMAL(5,2) AS $$
BEGIN
    IF total = 0 THEN
        RETURN 0;
    END IF;
    RETURN ROUND(((promoters::DECIMAL / total) - (detractors::DECIMAL / total)) * 100, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==============================================
-- 5. INDEXES
-- ==============================================

CREATE INDEX idx_nps_raw_survey_name ON nps_raw(survey_name);
CREATE INDEX idx_nps_raw_nps_score ON nps_raw(nps_score);
CREATE INDEX idx_nps_raw_creation_date ON nps_raw(creation_date);
CREATE INDEX idx_nps_raw_title_text ON nps_raw(title_text);

CREATE INDEX idx_nps_response_survey_name ON nps_response(survey_name);
CREATE INDEX idx_nps_response_nps_score ON nps_response(nps_score);
CREATE INDEX idx_nps_response_creation_date ON nps_response(creation_date);
CREATE INDEX idx_nps_response_title_text ON nps_response(title_text);
CREATE INDEX idx_nps_response_nps_category ON nps_response(nps_category);

CREATE INDEX idx_nps_ai_enrichment_response_id ON nps_ai_enrichment(response_id);
CREATE INDEX idx_nps_ai_enrichment_sentiment ON nps_ai_enrichment(sentiment);

-- ==============================================
-- 6. VIEWS
-- ==============================================

-- Basic NPS summary
CREATE OR REPLACE VIEW nps_summary AS
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
    ) as nps_score
FROM nps_response
GROUP BY survey_name;

-- ==============================================
-- 7. SAMPLE DATA
-- ==============================================

INSERT INTO nps_raw (survey_name, nps_score, nps_explanation, gender, age_range, years_employed, creation_date, title_text, raw_data) VALUES
('Q1 2024', 9, 'Geweldige service, zeer tevreden!', 'V', '35-44', '2-5 jaar', '2024-01-01', 'De Telegraaf', '{"survey": "Q1 2024", "nps": 9, "comment": "Geweldige service, zeer tevreden!"}'),
('Q1 2024', 7, 'Goed maar kan beter', 'M', '25-34', '1-2 jaar', '2024-01-02', 'Het Parool', '{"survey": "Q1 2024", "nps": 7, "comment": "Goed maar kan beter"}'),
('Q1 2024', 4, 'Te duur voor wat je krijgt', 'V', '45-54', '5+ jaar', '2024-01-03', 'Volkskrant', '{"survey": "Q1 2024", "nps": 4, "comment": "Te duur voor wat je krijgt"}');

INSERT INTO nps_response (raw_id, survey_name, nps_score, nps_explanation, gender, age_range, years_employed, creation_date, title_text, nps_category) VALUES
((SELECT id FROM nps_raw WHERE nps_explanation = 'Geweldige service, zeer tevreden!'), 'Q1 2024', 9, 'Geweldige service, zeer tevreden!', 'V', '35-44', '2-5 jaar', '2024-01-01', 'De Telegraaf', 'promoter'),
((SELECT id FROM nps_raw WHERE nps_explanation = 'Goed maar kan beter'), 'Q1 2024', 7, 'Goed maar kan beter', 'M', '25-34', '1-2 jaar', '2024-01-02', 'Het Parool', 'passive'),
((SELECT id FROM nps_raw WHERE nps_explanation = 'Te duur voor wat je krijgt'), 'Q1 2024', 4, 'Te duur voor wat je krijgt', 'V', '45-54', '5+ jaar', '2024-01-03', 'Volkskrant', 'detractor');

-- ==============================================
-- 8. PERMISSIONS (NO RLS FOR DEVELOPMENT)
-- ==============================================

-- Grant all permissions to all users
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Grant permissions to authenticated and anon users
GRANT ALL ON nps_raw TO authenticated, anon;
GRANT ALL ON nps_response TO authenticated, anon;
GRANT ALL ON nps_ai_enrichment TO authenticated, anon;

-- Grant permissions on views
GRANT ALL ON nps_summary TO authenticated, anon;

-- ==============================================
-- 9. ROW LEVEL SECURITY (DISABLED FOR DEVELOPMENT)
-- ==============================================

-- Disable RLS for development - this allows all operations
ALTER TABLE nps_raw DISABLE ROW LEVEL SECURITY;
ALTER TABLE nps_response DISABLE ROW LEVEL SECURITY;
ALTER TABLE nps_ai_enrichment DISABLE ROW LEVEL SECURITY;
