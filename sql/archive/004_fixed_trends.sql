-- Fixed trends analysis for minimal database setup
-- Run this AFTER the minimal setup is working

-- 1. Create monthly view
CREATE OR REPLACE VIEW v_nps_monthly AS
SELECT
  date_trunc('month', created_at)::date as month,
  title_text as title,
  survey_name as survey_type,
  nps_score
FROM nps_response
WHERE created_at IS NOT NULL;

-- 2. RPC: nps_trend_by_title
CREATE OR REPLACE FUNCTION nps_trend_by_title(
  p_start_date date default null,
  p_end_date date default null,
  p_survey text default null,
  p_title text default null
)
RETURNS TABLE(
  month date,
  title text,
  responses int,
  promoters int,
  passives int,
  detractors int,
  nps numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT * FROM v_nps_monthly
    WHERE (p_start_date IS NULL OR month >= date_trunc('month', p_start_date))
      AND (p_end_date IS NULL OR month <= date_trunc('month', p_end_date))
      AND (p_survey IS NULL OR survey_type = p_survey)
      AND (p_title IS NULL OR title = p_title)
  )
  SELECT
    month,
    title,
    COUNT(*) as responses,
    SUM(CASE WHEN nps_score >= 9 THEN 1 ELSE 0 END) as promoters,
    SUM(CASE WHEN nps_score BETWEEN 7 AND 8 THEN 1 ELSE 0 END) as passives,
    SUM(CASE WHEN nps_score <= 6 THEN 1 ELSE 0 END) as detractors,
    ROUND(
      ((SUM(CASE WHEN nps_score >= 9 THEN 1 ELSE 0 END) - 
        SUM(CASE WHEN nps_score <= 6 THEN 1 ELSE 0 END)) * 100.0) / 
      NULLIF(COUNT(*), 0), 1
    ) as nps
  FROM base
  GROUP BY month, title
  ORDER BY month ASC, title ASC;
END;
$$ LANGUAGE plpgsql;

-- 3. RPC: nps_trend_by_title_with_mom
CREATE OR REPLACE FUNCTION nps_trend_by_title_with_mom(
  p_start_date date default null,
  p_end_date date default null,
  p_survey text default null,
  p_title text default null
)
RETURNS TABLE(
  month date,
  title text,
  responses int,
  nps numeric,
  mom_delta numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH agg AS (
    SELECT * FROM nps_trend_by_title(p_start_date, p_end_date, p_survey, p_title)
  )
  SELECT
    month,
    title,
    responses,
    nps,
    ROUND(nps - LAG(nps) OVER (PARTITION BY title ORDER BY month), 1) as mom_delta
  FROM agg
  ORDER BY month, title;
END;
$$ LANGUAGE plpgsql;

-- 4. Vector search functions (placeholder until pgvector is enabled)
CREATE OR REPLACE FUNCTION similar_responses_by_vector(
  p_query text, -- JSON array as text until pgvector is enabled
  p_limit int default 10
)
RETURNS TABLE(
  response_id uuid,
  title text,
  survey_type text,
  created_at date,
  nps_score int,
  comment text,
  similarity numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id as response_id,
    r.title_text as title,
    r.survey_name as survey_type,
    r.creation_date as created_at,
    r.nps_score,
    r.nps_explanation as comment,
    0.0::numeric as similarity -- Placeholder until pgvector is enabled
  FROM nps_response r
  JOIN nps_ai_enrichment e ON e.response_id = r.id
  WHERE e.embedded_vector IS NOT NULL
  ORDER BY r.created_at DESC -- Placeholder ordering until pgvector is enabled
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION similar_responses_for_response(
  p_response_id uuid,
  p_limit int default 10
)
RETURNS TABLE(
  response_id uuid,
  title text,
  survey_type text,
  created_at date,
  nps_score int,
  comment text,
  similarity numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id as response_id,
    r.title_text as title,
    r.survey_name as survey_type,
    r.creation_date as created_at,
    r.nps_score,
    r.nps_explanation as comment,
    0.0::numeric as similarity -- Placeholder until pgvector is enabled
  FROM nps_response r
  JOIN nps_ai_enrichment e ON e.response_id = r.id
  WHERE e.embedded_vector IS NOT NULL
    AND r.id <> p_response_id
  ORDER BY r.created_at DESC -- Placeholder ordering until pgvector is enabled
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 5. Performance indexes
-- Note: date_trunc index requires IMMUTABLE function, so we'll create a regular index on created_at
CREATE INDEX IF NOT EXISTS idx_resp_created ON nps_response(created_at);
CREATE INDEX IF NOT EXISTS idx_resp_title ON nps_response(title_text);
CREATE INDEX IF NOT EXISTS idx_resp_survey ON nps_response(survey_name);
