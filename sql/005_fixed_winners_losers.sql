-- Fixed winners/losers analysis for minimal database setup
-- Run this AFTER the minimal setup and themes are working

-- 1. Ensure we have the required view (from themes)
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

-- 2. Ensure we have the monthly view (from trends)
CREATE OR REPLACE VIEW v_nps_monthly AS
SELECT
  date_trunc('month', created_at)::date as month,
  title_text as title,
  survey_name as survey_type,
  nps_score
FROM nps_response
WHERE created_at IS NOT NULL;

-- 3. Ensure we have the trend function (from trends)
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
  WITH base AS (
    SELECT * FROM v_nps_monthly
    WHERE (p_start_date IS NULL OR month >= date_trunc('month', p_start_date))
      AND (p_end_date IS NULL OR month <= date_trunc('month', p_end_date))
      AND (p_survey IS NULL OR survey_type = p_survey)
      AND (p_title IS NULL OR title = p_title)
  ),
  agg AS (
    SELECT
      month,
      title,
      COUNT(*) as responses,
      ROUND(
        ((SUM(CASE WHEN nps_score >= 9 THEN 1 ELSE 0 END) - 
          SUM(CASE WHEN nps_score <= 6 THEN 1 ELSE 0 END)) * 100.0) / 
        NULLIF(COUNT(*), 0), 1
      ) as nps
    FROM base
    GROUP BY month, title
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

-- 4. Top MoM movers (Winners/Losers)
CREATE OR REPLACE FUNCTION top_title_mom_moves(
  p_start_date date default null,
  p_end_date date default null,
  p_survey text default null,
  p_min_responses int default 30,
  p_top_k int default 5
)
RETURNS TABLE(
  month date,
  title text,
  responses int,
  nps numeric,
  mom_delta numeric,
  move text
) AS $$
BEGIN
  RETURN QUERY
  WITH series AS (
    SELECT * FROM nps_trend_by_title_with_mom(p_start_date, p_end_date, p_survey, null)
  ),
  latest AS (
    SELECT MAX(month) as latest_month FROM series
  ),
  latest_rows AS (
    SELECT s.* 
    FROM series s
    JOIN latest l ON s.month = l.latest_month
    WHERE s.responses >= p_min_responses
  ),
  ranked_up AS (
    SELECT * FROM latest_rows
    WHERE mom_delta IS NOT NULL
    ORDER BY mom_delta DESC, responses DESC
    LIMIT p_top_k
  ),
  ranked_down AS (
    SELECT * FROM latest_rows
    WHERE mom_delta IS NOT NULL
    ORDER BY mom_delta ASC, responses DESC
    LIMIT p_top_k
  )
  SELECT month, title, responses, nps, mom_delta, 'up'::text as move
  FROM ranked_up
  UNION ALL
  SELECT month, title, responses, nps, mom_delta, 'down'::text as move
  FROM ranked_down
  ORDER BY move ASC, mom_delta DESC, title ASC;
END;
$$ LANGUAGE plpgsql;

-- 5. Theme drivers for a title
CREATE OR REPLACE FUNCTION title_theme_share_mom(
  p_title text,
  p_survey text default null
)
RETURNS TABLE(
  month date,
  theme text,
  count_responses bigint,
  share_pct numeric,
  mom_share_delta numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      t.title,
      t.theme,
      date_trunc('month', t.created_at)::date as month,
      t.response_id
    FROM v_nps_response_themes t
    WHERE t.title = p_title
      AND (p_survey IS NULL OR t.survey_type = p_survey)
  ),
  counts AS (
    SELECT
      month,
      theme,
      COUNT(DISTINCT response_id) as cnt
    FROM base
    GROUP BY month, theme
  ),
  totals AS (
    SELECT
      month,
      SUM(cnt) as total_cnt
    FROM counts
    GROUP BY month
  ),
  shares AS (
    SELECT
      c.month,
      c.theme,
      c.cnt as count_responses,
      CASE 
        WHEN t.total_cnt = 0 THEN 0 
        ELSE ROUND(c.cnt::numeric * 100 / t.total_cnt, 2)
      END as share_pct
    FROM counts c
    JOIN totals t USING (month)
  )
  SELECT
    s.month,
    s.theme,
    s.count_responses,
    s.share_pct,
    ROUND(s.share_pct - LAG(s.share_pct) OVER (PARTITION BY s.theme ORDER BY s.month), 2) as mom_share_delta
  FROM shares s
  ORDER BY s.month ASC, s.theme ASC;
END;
$$ LANGUAGE plpgsql;

-- 6. Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_resp_created ON nps_response(created_at);
CREATE INDEX IF NOT EXISTS idx_resp_title ON nps_response(title_text);
CREATE INDEX IF NOT EXISTS idx_resp_survey ON nps_response(survey_name);
CREATE INDEX IF NOT EXISTS idx_enrich_themes_gin ON nps_ai_enrichment USING gin (themes);
