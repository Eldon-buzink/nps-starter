-- Refresh views to ensure they reflect the updated theme data
-- This script recreates the views to show the latest theme classifications

-- Drop existing views to ensure fresh data
DROP VIEW IF EXISTS v_theme_assignments_normalized CASCADE;
DROP VIEW IF EXISTS v_theme_overview_normalized CASCADE;

-- Recreate the theme assignments view with fresh data
CREATE VIEW v_theme_assignments_normalized AS
SELECT 
    e.response_id,
    unnest(e.themes) as canonical_theme,
    r.title_text,
    r.nps_score,
    r.creation_date,
    r.survey_name
FROM nps_ai_enrichment e
JOIN nps_response r ON e.response_id = r.id;

-- Recreate the theme overview view with fresh data
CREATE VIEW v_theme_overview_normalized AS
SELECT 
    canonical_theme as theme,
    COUNT(*) as mentions,
    ROUND(AVG(nps_score), 1) as avg_nps,
    COUNT(CASE WHEN nps_score >= 9 THEN 1 END) as promoters,
    COUNT(CASE WHEN nps_score >= 7 AND nps_score <= 8 THEN 1 END) as passives,
    COUNT(CASE WHEN nps_score <= 6 THEN 1 END) as detractors,
    ROUND((COUNT(CASE WHEN nps_score >= 9 THEN 1 END)::numeric / COUNT(*)) * 100, 1) as pct_promoters,
    ROUND((COUNT(CASE WHEN nps_score >= 7 AND nps_score <= 8 THEN 1 END)::numeric / COUNT(*)) * 100, 1) as pct_passives,
    ROUND((COUNT(CASE WHEN nps_score <= 6 THEN 1 END)::numeric / COUNT(*)) * 100, 1) as pct_detractors
FROM v_theme_assignments_normalized
GROUP BY canonical_theme
ORDER BY mentions DESC;

-- Show the updated theme distribution
SELECT 'Updated theme distribution after view refresh:' as info;
SELECT 
  theme,
  mentions,
  round((mentions::numeric / sum(mentions) over()) * 100, 1) as percentage
FROM v_theme_overview_normalized
ORDER BY mentions DESC
LIMIT 10;
