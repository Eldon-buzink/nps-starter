-- Simple NPS Database Setup
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist
DROP TABLE IF EXISTS nps_ai_enrichment CASCADE;
DROP TABLE IF EXISTS nps_response CASCADE;
DROP TABLE IF EXISTS nps_raw CASCADE;

-- Create nps_raw table
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

-- Create nps_response table
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

-- Create nps_ai_enrichment table
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

-- Create indexes for better performance
CREATE INDEX idx_nps_response_survey_name ON nps_response(survey_name);
CREATE INDEX idx_nps_response_nps_score ON nps_response(nps_score);
CREATE INDEX idx_nps_response_creation_date ON nps_response(creation_date);
CREATE INDEX idx_nps_response_title_text ON nps_response(title_text);
CREATE INDEX idx_nps_response_nps_category ON nps_response(nps_category);

-- Enable Row Level Security
ALTER TABLE nps_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_ai_enrichment ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all operations for now)
CREATE POLICY "Allow all operations for authenticated users" ON nps_raw
    FOR ALL USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON nps_response
    FOR ALL USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON nps_ai_enrichment
    FOR ALL USING (true);

-- Insert some sample data
INSERT INTO nps_raw (survey_name, nps_score, nps_explanation, gender, age_range, years_employed, creation_date, title_text, raw_data) VALUES
('Q1 2024', 9, 'Geweldige service, zeer tevreden!', 'V', '35-44', '2-5 jaar', '2024-01-01', 'De Telegraaf', '{"survey": "Q1 2024", "nps": 9, "comment": "Geweldige service, zeer tevreden!"}'),
('Q1 2024', 7, 'Goed maar kan beter', 'M', '25-34', '1-2 jaar', '2024-01-02', 'Het Parool', '{"survey": "Q1 2024", "nps": 7, "comment": "Goed maar kan beter"}'),
('Q1 2024', 4, 'Te duur voor wat je krijgt', 'V', '45-54', '5+ jaar', '2024-01-03', 'Volkskrant', '{"survey": "Q1 2024", "nps": 4, "comment": "Te duur voor wat je krijgt"}');

-- Insert corresponding response data
INSERT INTO nps_response (raw_id, survey_name, nps_score, nps_explanation, gender, age_range, years_employed, creation_date, title_text, nps_category) VALUES
((SELECT id FROM nps_raw WHERE nps_explanation = 'Geweldige service, zeer tevreden!'), 'Q1 2024', 9, 'Geweldige service, zeer tevreden!', 'V', '35-44', '2-5 jaar', '2024-01-01', 'De Telegraaf', 'promoter'),
((SELECT id FROM nps_raw WHERE nps_explanation = 'Goed maar kan beter'), 'Q1 2024', 7, 'Goed maar kan beter', 'M', '25-34', '1-2 jaar', '2024-01-02', 'Het Parool', 'passive'),
((SELECT id FROM nps_raw WHERE nps_explanation = 'Te duur voor wat je krijgt'), 'Q1 2024', 4, 'Te duur voor wat je krijgt', 'V', '45-54', '5+ jaar', '2024-01-03', 'Volkskrant', 'detractor');

-- Create a simple view for NPS summary
CREATE OR REPLACE VIEW nps_summary AS
SELECT 
    survey_name,
    COUNT(*) as total_responses,
    COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END) as promoters,
    COUNT(CASE WHEN nps_category = 'passive' THEN 1 END) as passives,
    COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END) as detractors,
    ROUND(AVG(nps_score), 2) as average_score,
    ROUND(((COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END)::DECIMAL / COUNT(*)) - (COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END)::DECIMAL / COUNT(*))) * 100, 2) as nps_score
FROM nps_response
GROUP BY survey_name;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;
