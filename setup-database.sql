-- NPS Insights Tool - Complete Database Setup
-- Run this script in your Supabase SQL Editor

-- ==============================================
-- 1. INITIAL SCHEMA SETUP
-- ==============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create raw data table for initial CSV imports
CREATE TABLE IF NOT EXISTS nps_raw (
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
CREATE TABLE IF NOT EXISTS nps_response (
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

-- Create AI enrichment table
CREATE TABLE IF NOT EXISTS nps_ai_enrichment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID REFERENCES nps_response(id) ON DELETE CASCADE,
    -- AI analysis results
    themes JSONB, -- Array of identified themes
    sentiment_score DECIMAL(3,2), -- -1.0 to 1.0
    sentiment_label VARCHAR(20), -- positive, negative, neutral
    keywords JSONB, -- Array of extracted keywords
    summary TEXT, -- AI-generated summary
    -- Processing metadata
    ai_model VARCHAR(100),
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily rollup table for performance
CREATE TABLE IF NOT EXISTS nps_daily_rollup (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_name VARCHAR(255) NOT NULL,
    rollup_date DATE NOT NULL,
    -- NPS metrics
    total_responses INTEGER DEFAULT 0,
    promoters INTEGER DEFAULT 0,
    passives INTEGER DEFAULT 0,
    detractors INTEGER DEFAULT 0,
    nps_score DECIMAL(5,2), -- Calculated NPS score
    -- Demographics breakdown
    gender_breakdown JSONB,
    age_breakdown JSONB,
    employment_breakdown JSONB,
    -- Theme analysis
    top_themes JSONB,
    sentiment_distribution JSONB,
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(survey_name, rollup_date)
);

-- ==============================================
-- 2. INDEXES FOR PERFORMANCE
-- ==============================================

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nps_raw_survey ON nps_raw(survey_name);
CREATE INDEX IF NOT EXISTS idx_nps_raw_created ON nps_raw(created_at);
CREATE INDEX IF NOT EXISTS idx_nps_response_survey ON nps_response(survey_name);
CREATE INDEX IF NOT EXISTS idx_nps_response_category ON nps_response(nps_category);
CREATE INDEX IF NOT EXISTS idx_nps_response_created ON nps_response(created_at);
CREATE INDEX IF NOT EXISTS idx_nps_ai_enrichment_response ON nps_ai_enrichment(response_id);
CREATE INDEX IF NOT EXISTS idx_nps_ai_enrichment_status ON nps_ai_enrichment(processing_status);
CREATE INDEX IF NOT EXISTS idx_nps_daily_rollup_survey_date ON nps_daily_rollup(survey_name, rollup_date);

-- ==============================================
-- 3. HELPER FUNCTIONS
-- ==============================================

-- Create function to automatically categorize NPS scores
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

-- Create function to calculate NPS score
CREATE OR REPLACE FUNCTION calculate_nps_score(promoters BIGINT, detractors BIGINT, total BIGINT)
RETURNS DECIMAL(5,2) AS $$
BEGIN
    IF total = 0 THEN
        RETURN 0;
    END IF;
    RETURN ROUND(((promoters::DECIMAL / total) - (detractors::DECIMAL / total)) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
DROP TRIGGER IF EXISTS update_nps_raw_updated_at ON nps_raw;
CREATE TRIGGER update_nps_raw_updated_at BEFORE UPDATE ON nps_raw FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nps_response_updated_at ON nps_response;
CREATE TRIGGER update_nps_response_updated_at BEFORE UPDATE ON nps_response FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nps_ai_enrichment_updated_at ON nps_ai_enrichment;
CREATE TRIGGER update_nps_ai_enrichment_updated_at BEFORE UPDATE ON nps_ai_enrichment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nps_daily_rollup_updated_at ON nps_daily_rollup;
CREATE TRIGGER update_nps_daily_rollup_updated_at BEFORE UPDATE ON nps_daily_rollup FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- 4. VIEWS FOR ANALYTICS
-- ==============================================

-- Main NPS summary view with all data joined
CREATE OR REPLACE VIEW nps_summary AS
SELECT 
    r.id,
    r.survey_name,
    r.nps_score,
    r.nps_explanation,
    r.gender,
    r.age_range,
    r.years_employed,
    r.creation_date,
    r.title_text,
    r.nps_category,
    r.word_count,
    r.has_explanation,
    r.created_at,
    -- AI enrichment data
    ai.themes,
    ai.sentiment_score,
    ai.sentiment_label,
    ai.keywords,
    ai.summary,
    ai.processing_status as ai_status
FROM nps_response r
LEFT JOIN nps_ai_enrichment ai ON r.id = ai.response_id;

-- NPS metrics by survey
CREATE OR REPLACE VIEW nps_survey_metrics AS
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

-- Daily NPS trends
CREATE OR REPLACE VIEW nps_daily_trends AS
SELECT 
    survey_name,
    creation_date,
    COUNT(*) as daily_responses,
    COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END) as daily_promoters,
    COUNT(CASE WHEN nps_category = 'passive' THEN 1 END) as daily_passives,
    COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END) as daily_detractors,
    ROUND(AVG(nps_score), 2) as daily_avg_score,
    calculate_nps_score(
        COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END)::BIGINT,
        COUNT(*)::BIGINT
    ) as daily_nps_score
FROM nps_response
GROUP BY survey_name, creation_date
ORDER BY survey_name, creation_date;

-- Theme analysis view
CREATE OR REPLACE VIEW nps_theme_analysis AS
SELECT 
    survey_name,
    theme,
    COUNT(*) as theme_count,
    ROUND(AVG(sentiment_score), 3) as avg_sentiment,
    COUNT(CASE WHEN sentiment_label = 'positive' THEN 1 END) as positive_count,
    COUNT(CASE WHEN sentiment_label = 'negative' THEN 1 END) as negative_count,
    COUNT(CASE WHEN sentiment_label = 'neutral' THEN 1 END) as neutral_count
FROM nps_response r
JOIN nps_ai_enrichment ai ON r.id = ai.response_id,
LATERAL jsonb_array_elements_text(ai.themes) as theme
WHERE ai.processing_status = 'completed'
GROUP BY survey_name, theme
ORDER BY survey_name, theme_count DESC;

-- Demographics breakdown view
CREATE OR REPLACE VIEW nps_demographics AS
SELECT 
    survey_name,
    gender,
    age_range,
    years_employed,
    COUNT(*) as response_count,
    ROUND(AVG(nps_score), 2) as avg_score,
    calculate_nps_score(
        COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END)::BIGINT,
        COUNT(*)::BIGINT
    ) as nps_score
FROM nps_response
GROUP BY survey_name, gender, age_range, years_employed
ORDER BY survey_name, response_count DESC;

-- Recent responses view (last 30 days)
CREATE OR REPLACE VIEW nps_recent_responses AS
SELECT 
    r.*,
    ai.themes,
    ai.sentiment_score,
    ai.sentiment_label,
    ai.keywords,
    ai.summary
FROM nps_response r
LEFT JOIN nps_ai_enrichment ai ON r.id = ai.response_id
WHERE r.created_at >= NOW() - INTERVAL '30 days'
ORDER BY r.created_at DESC;

-- ==============================================
-- 5. ROW LEVEL SECURITY SETUP
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE nps_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_ai_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_daily_rollup ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (for now - you can restrict later)
CREATE POLICY "Allow all operations for authenticated users" ON nps_raw
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON nps_response
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON nps_ai_enrichment
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON nps_daily_rollup
    FOR ALL TO authenticated USING (true);

-- Note: Views don't need RLS policies as they inherit permissions from underlying tables

-- ==============================================
-- 6. SAMPLE DATA INSERTION
-- ==============================================

-- Insert sample data from your CSV
INSERT INTO nps_raw (survey_name, nps_score, nps_explanation, gender, age_range, years_employed, creation_date, title_text, raw_data)
VALUES (
    'LLT_Nieuws',
    9,
    'Goede krant',
    'Man',
    '65-74',
    '11-20 jaar',
    '2025-03-18',
    'Trouw',
    '{"SURVEY": "LLT_Nieuws", "NPS": 9, "NPS_TOELICHTING": "Goede krant", "GESLACHT": "Man", "LEEFTIJD": "65-74", "ABOJAREN": "11-20 jaar", "CREATIE_DT": "2025-03-18", "TITEL_TEKST": "Trouw"}'
);

-- Process the sample data
INSERT INTO nps_response (raw_id, survey_name, nps_score, nps_explanation, gender, age_range, years_employed, creation_date, title_text, nps_category, word_count, has_explanation)
SELECT 
    id as raw_id,
    survey_name,
    nps_score,
    nps_explanation,
    gender,
    age_range,
    years_employed,
    creation_date,
    title_text,
    categorize_nps_score(nps_score) as nps_category,
    CASE 
        WHEN nps_explanation IS NOT NULL THEN array_length(string_to_array(nps_explanation, ' '), 1)
        ELSE 0
    END as word_count,
    CASE 
        WHEN nps_explanation IS NOT NULL AND nps_explanation != '' THEN true
        ELSE false
    END as has_explanation
FROM nps_raw
WHERE survey_name = 'LLT_Nieuws';

-- ==============================================
-- 7. VERIFICATION QUERIES
-- ==============================================

-- Verify the setup
SELECT 'Database setup completed successfully!' as status;

-- Show sample data
SELECT 
    survey_name,
    total_responses,
    promoters,
    passives,
    detractors,
    nps_score
FROM nps_survey_metrics;

-- Show recent responses
SELECT 
    survey_name,
    nps_score,
    nps_category,
    nps_explanation,
    created_at
FROM nps_recent_responses
LIMIT 5;
