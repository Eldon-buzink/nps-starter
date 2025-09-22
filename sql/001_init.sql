-- NPS Tool Database Schema
-- This file contains the initial database setup for the NPS insights tool

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

-- Create AI enrichment table
CREATE TABLE nps_ai_enrichment (
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
CREATE TABLE nps_daily_rollup (
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

-- Create indexes for performance
CREATE INDEX idx_nps_raw_survey ON nps_raw(survey_name);
CREATE INDEX idx_nps_raw_created ON nps_raw(created_at);
CREATE INDEX idx_nps_response_survey ON nps_response(survey_name);
CREATE INDEX idx_nps_response_category ON nps_response(nps_category);
CREATE INDEX idx_nps_response_created ON nps_response(created_at);
CREATE INDEX idx_nps_ai_enrichment_response ON nps_ai_enrichment(response_id);
CREATE INDEX idx_nps_ai_enrichment_status ON nps_ai_enrichment(processing_status);
CREATE INDEX idx_nps_daily_rollup_survey_date ON nps_daily_rollup(survey_name, rollup_date);

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
CREATE OR REPLACE FUNCTION calculate_nps_score(promoters INTEGER, detractors INTEGER, total INTEGER)
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
CREATE TRIGGER update_nps_raw_updated_at BEFORE UPDATE ON nps_raw FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nps_response_updated_at BEFORE UPDATE ON nps_response FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nps_ai_enrichment_updated_at BEFORE UPDATE ON nps_ai_enrichment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nps_daily_rollup_updated_at BEFORE UPDATE ON nps_daily_rollup FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
