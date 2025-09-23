-- Fixed themes analysis for minimal database setup
-- Run this AFTER the minimal setup is working

-- 1. Create the themes view that explodes themes per response
CREATE OR REPLACE VIEW v_nps_response_themes AS
WITH exploded AS (
  SELECT
    r.id as response_id,
    r.created_at,
    r.survey_name as survey_type,
    r.title_text as title,
    r.nps_score,
    e.sentiment,
    e.themes
  FROM nps_response r
  JOIN nps_ai_enrichment e ON e.response_id = r.id
  WHERE e.themes IS NOT NULL
)
SELECT
  response_id,
  created_at,
  survey_type,
  title,
  nps_score,
  sentiment,
  unnest(themes) as theme
FROM exploded;

-- 2. RPC: themes_aggregate (filters + metrics)
CREATE OR REPLACE FUNCTION themes_aggregate(
  p_start_date date default null,
  p_end_date date default null,
  p_survey text default null,
  p_title text default null,
  p_nps_bucket text default null
)
RETURNS TABLE(
  theme text,
  count_responses bigint,
  share_pct numeric,
  avg_sentiment numeric,
  avg_nps numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT * FROM v_nps_response_themes t
    WHERE (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at < p_end_date + interval '1 day')
      AND (p_survey IS NULL OR t.survey_type = p_survey)
      AND (p_title IS NULL OR t.title = p_title)
      AND (
        p_nps_bucket IS NULL OR
        (p_nps_bucket = 'promoter' AND t.nps_score >= 9) OR
        (p_nps_bucket = 'passive' AND t.nps_score BETWEEN 7 AND 8) OR
        (p_nps_bucket = 'detractor' AND t.nps_score <= 6)
      )
  ),
  by_theme AS (
    SELECT
      theme,
      COUNT(DISTINCT response_id) as count_responses,
      AVG(NULLIF(sentiment, NULL)) as avg_sentiment,
      AVG(nps_score::numeric) as avg_nps
    FROM base
    GROUP BY theme
  ),
  totals AS (
    SELECT SUM(count_responses) as total_cnt
    FROM by_theme
  )
  SELECT
    bt.theme,
    bt.count_responses,
    CASE 
      WHEN COALESCE(t.total_cnt, 0) = 0 THEN 0 
      ELSE ROUND((bt.count_responses::numeric * 100) / t.total_cnt, 1)
    END as share_pct,
    ROUND(bt.avg_sentiment::numeric, 3) as avg_sentiment,
    ROUND(bt.avg_nps::numeric, 1) as avg_nps
  FROM by_theme bt
  CROSS JOIN totals t
  ORDER BY bt.count_responses DESC, bt.theme ASC;
END;
$$ LANGUAGE plpgsql;

-- 3. RPC: themes_promoter_detractor
CREATE OR REPLACE FUNCTION themes_promoter_detractor(
  p_start_date date default null,
  p_end_date date default null,
  p_survey text default null,
  p_title text default null
)
RETURNS TABLE(
  theme text,
  promoters bigint,
  detractors bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT * FROM v_nps_response_themes t
    WHERE (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at < p_end_date + interval '1 day')
      AND (p_survey IS NULL OR t.survey_type = p_survey)
      AND (p_title IS NULL OR t.title = p_title)
  )
  SELECT
    theme,
    COUNT(DISTINCT CASE WHEN nps_score >= 9 THEN response_id END) as promoters,
    COUNT(DISTINCT CASE WHEN nps_score <= 6 THEN response_id END) as detractors
  FROM base
  GROUP BY theme
  ORDER BY (promoters + detractors) DESC, theme ASC;
END;
$$ LANGUAGE plpgsql;

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_resp_created ON nps_response(created_at);
CREATE INDEX IF NOT EXISTS idx_resp_title ON nps_response(title_text);
CREATE INDEX IF NOT EXISTS idx_resp_survey ON nps_response(survey_name);
CREATE INDEX IF NOT EXISTS idx_enrich_themes_gin ON nps_ai_enrichment USING gin (themes);
