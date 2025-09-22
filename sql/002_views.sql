-- NPS Summary Views
-- This file contains views for easy data access and reporting

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
        COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END),
        COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END),
        COUNT(*)
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
        COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END),
        COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END),
        COUNT(*)
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
        COUNT(CASE WHEN nps_category = 'promoter' THEN 1 END),
        COUNT(CASE WHEN nps_category = 'detractor' THEN 1 END),
        COUNT(*)
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
