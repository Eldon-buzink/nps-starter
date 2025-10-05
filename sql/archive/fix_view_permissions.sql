-- Fix permissions for the v_nps_response_themes view
-- This view is needed by the themes_aggregate and themes_promoter_detractor RPC functions

-- Grant permissions to the view
GRANT SELECT ON v_nps_response_themes TO postgres, authenticated, anon, service_role;

-- Also ensure the view exists and is properly defined
CREATE OR REPLACE VIEW v_nps_response_themes AS
WITH exploded AS (
  SELECT
    r.id AS response_id,
    r.created_at,
    r.survey_name,
    r.title_text,
    r.nps_score,
    e.sentiment_score,
    e.themes
  FROM nps_response r
  JOIN nps_ai_enrichment e ON e.response_id = r.id
  WHERE e.themes IS NOT NULL
)
SELECT response_id, created_at, survey_name, title_text, nps_score, sentiment_score, unnest(themes) AS theme
FROM exploded;

-- Grant permissions again after recreating
GRANT SELECT ON v_nps_response_themes TO postgres, authenticated, anon, service_role;
