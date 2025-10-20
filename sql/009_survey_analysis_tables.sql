-- Survey Analysis Tables
-- This script creates the necessary tables for the survey analysis feature

-- Create survey_analyses table
CREATE TABLE IF NOT EXISTS survey_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    total_responses INTEGER NOT NULL,
    response_column TEXT NOT NULL,
    headers TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    analysis_results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create survey_responses table
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES survey_analyses(id) ON DELETE CASCADE,
    response_id UUID NOT NULL,
    row_number INTEGER NOT NULL,
    response_text TEXT NOT NULL,
    metadata JSONB,
    ai_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create survey_themes table for AI-generated themes
CREATE TABLE IF NOT EXISTS survey_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES survey_analyses(id) ON DELETE CASCADE,
    theme_name TEXT NOT NULL,
    theme_description TEXT,
    mention_count INTEGER NOT NULL DEFAULT 0,
    sentiment_score DECIMAL(3,2),
    sample_responses TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create survey_insights table for key insights
CREATE TABLE IF NOT EXISTS survey_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES survey_analyses(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('theme', 'sentiment', 'recommendation', 'summary')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority INTEGER DEFAULT 1,
    supporting_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_response_id ON survey_responses(response_id);
CREATE INDEX IF NOT EXISTS idx_survey_themes_survey_id ON survey_themes(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_insights_survey_id ON survey_insights(survey_id);

-- Grant permissions
GRANT ALL ON survey_analyses TO anon, authenticated;
GRANT ALL ON survey_responses TO anon, authenticated;
GRANT ALL ON survey_themes TO anon, authenticated;
GRANT ALL ON survey_insights TO anon, authenticated;

-- Create a view for survey analysis summary
CREATE OR REPLACE VIEW v_survey_analysis_summary AS
SELECT 
    sa.id,
    sa.name,
    sa.original_filename,
    sa.total_responses,
    sa.status,
    sa.created_at,
    COUNT(sr.id) as processed_responses,
    COUNT(st.id) as theme_count,
    COUNT(si.id) as insight_count,
    sa.analysis_results
FROM survey_analyses sa
LEFT JOIN survey_responses sr ON sa.id = sr.survey_id
LEFT JOIN survey_themes st ON sa.id = st.survey_id
LEFT JOIN survey_insights si ON sa.id = si.survey_id
GROUP BY sa.id, sa.name, sa.original_filename, sa.total_responses, sa.status, sa.created_at, sa.analysis_results;

-- Grant permissions on the view
GRANT ALL ON v_survey_analysis_summary TO anon, authenticated;
