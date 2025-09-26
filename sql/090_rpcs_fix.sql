-- Monthly overall trends
CREATE OR REPLACE FUNCTION nps_trend_overall(
  p_start DATE DEFAULT NULL,
  p_end   DATE DEFAULT NULL,
  p_survey TEXT DEFAULT NULL,
  p_title  TEXT DEFAULT NULL
)
RETURNS TABLE (month DATE, responses INT, nps NUMERIC)
LANGUAGE SQL STABLE AS $$
  WITH base AS (
    SELECT DATE_TRUNC('month', created_at)::DATE m, nps_score
    FROM nps_response
    WHERE (p_start IS NULL OR created_at >= p_start)
      AND (p_end   IS NULL OR created_at <  p_end + INTERVAL '1 day')
      AND (p_survey IS NULL OR survey_name = p_survey)
      AND (p_title  IS NULL OR title_text = p_title)
  )
  SELECT
    m AS month,
    COUNT(*) AS responses,
    ROUND(((SUM(CASE WHEN nps_score >= 9 THEN 1 ELSE 0 END)
         -  SUM(CASE WHEN nps_score <= 6 THEN 1 ELSE 0 END)) * 100.0)
         / NULLIF(COUNT(*),0), 1) AS nps
  FROM base
  GROUP BY 1
  ORDER BY 1;
$$;

-- Summary for KPI cards with MoM
CREATE OR REPLACE FUNCTION v_nps_summary(
  p_start DATE DEFAULT NULL,
  p_end   DATE DEFAULT NULL,
  p_survey TEXT DEFAULT NULL,
  p_title  TEXT DEFAULT NULL
)
RETURNS TABLE (
  responses INT,
  promoters INT,
  passives INT,
  detractors INT,
  nps NUMERIC,
  prev_nps NUMERIC,
  mom_delta NUMERIC
)
LANGUAGE SQL STABLE AS $$
  WITH base AS (
    SELECT * FROM nps_response
    WHERE (p_start IS NULL OR created_at >= p_start)
      AND (p_end   IS NULL OR created_at <  p_end + INTERVAL '1 day')
      AND (p_survey IS NULL OR survey_name = p_survey)
      AND (p_title  IS NULL OR title_text = p_title)
  ),
  curr AS (
    SELECT
      COUNT(*) AS responses,
      SUM(CASE WHEN nps_score >= 9 THEN 1 ELSE 0 END) AS promoters,
      SUM(CASE WHEN nps_score BETWEEN 7 AND 8 THEN 1 ELSE 0 END) AS passives,
      SUM(CASE WHEN nps_score <= 6 THEN 1 ELSE 0 END) AS detractors,
      ROUND(((SUM(CASE WHEN nps_score >= 9 THEN 1 ELSE 0 END)
           -  SUM(CASE WHEN nps_score <= 6 THEN 1 ELSE 0 END)) * 100.0)
           / NULLIF(COUNT(*),0), 1) AS nps
    FROM base
  ),
  prev_window AS (
    SELECT
      MIN(DATE_TRUNC('month', created_at)) AS minm
    FROM base
  ),
  prev AS (
    SELECT
      ROUND(((SUM(CASE WHEN nps_score >= 9 THEN 1 ELSE 0 END)
           -  SUM(CASE WHEN nps_score <= 6 THEN 1 ELSE 0 END)) * 100.0)
           / NULLIF(COUNT(*),0), 1) AS prev_nps
    FROM nps_response
    WHERE created_at >= (SELECT minm - INTERVAL '1 month' FROM prev_window)
      AND created_at <  (SELECT minm FROM prev_window)
      AND (p_survey IS NULL OR survey_name = p_survey)
      AND (p_title  IS NULL OR title_text = p_title)
  )
  SELECT
    curr.responses, curr.promoters, curr.passives, curr.detractors,
    curr.nps, prev.prev_nps,
    ROUND(curr.nps - prev.prev_nps, 1) AS mom_delta
  FROM curr CROSS JOIN prev;
$$;

-- Themes exploded view (for aggregations)
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

-- Per-theme aggregates
CREATE OR REPLACE FUNCTION themes_aggregate(
  p_start_date DATE DEFAULT NULL,
  p_end_date   DATE DEFAULT NULL,
  p_survey     TEXT DEFAULT NULL,
  p_title      TEXT DEFAULT NULL,
  p_nps_bucket TEXT DEFAULT NULL
)
RETURNS TABLE(
  theme TEXT,
  count_responses BIGINT,
  share_pct NUMERIC,
  avg_sentiment NUMERIC,
  avg_nps NUMERIC
)
LANGUAGE SQL STABLE AS $$
  WITH base AS (
    SELECT *
    FROM v_nps_response_themes t
    WHERE (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date   IS NULL OR t.created_at <  p_end_date + INTERVAL '1 day')
      AND (p_survey     IS NULL OR t.survey_name = p_survey)
      AND (p_title      IS NULL OR t.title_text = p_title)
      AND (
        p_nps_bucket IS NULL
        OR (p_nps_bucket = 'promoter'  AND t.nps_score >= 9)
        OR (p_nps_bucket = 'passive'   AND t.nps_score BETWEEN 7 AND 8)
        OR (p_nps_bucket = 'detractor' AND t.nps_score <= 6)
      )
  ),
  by_theme AS (
    SELECT
      theme,
      COUNT(DISTINCT response_id) AS count_responses,
      AVG(sentiment_score) AS avg_sentiment,
      AVG(nps_score::NUMERIC) AS avg_nps
    FROM base
    GROUP BY theme
  ),
  totals AS ( SELECT SUM(count_responses) AS total_cnt FROM by_theme )
  SELECT
    bt.theme,
    bt.count_responses,
    CASE WHEN COALESCE(t.total_cnt,0)=0 THEN 0
         ELSE ROUND(bt.count_responses::NUMERIC*100/t.total_cnt,1) END AS share_pct,
    ROUND(bt.avg_sentiment::NUMERIC,3) AS avg_sentiment,
    ROUND(bt.avg_nps::NUMERIC,1)       AS avg_nps
  FROM by_theme bt CROSS JOIN totals t
  ORDER BY bt.count_responses DESC, bt.theme ASC;
$$;

-- Promoters vs Detractors per theme
CREATE OR REPLACE FUNCTION themes_promoter_detractor(
  p_start_date DATE DEFAULT NULL,
  p_end_date   DATE DEFAULT NULL,
  p_survey     TEXT DEFAULT NULL,
  p_title      TEXT DEFAULT NULL
)
RETURNS TABLE(theme TEXT, promoters BIGINT, detractors BIGINT)
LANGUAGE SQL STABLE AS $$
  WITH base AS (
    SELECT *
    FROM v_nps_response_themes t
    WHERE (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date   IS NULL OR t.created_at <  p_end_date + INTERVAL '1 day')
      AND (p_survey     IS NULL OR t.survey_name = p_survey)
      AND (p_title      IS NULL OR t.title_text = p_title)
  )
  SELECT
    theme,
    COUNT(DISTINCT CASE WHEN nps_score >= 9 THEN response_id END) AS promoters,
    COUNT(DISTINCT CASE WHEN nps_score <= 6 THEN response_id END) AS detractors
  FROM base
  GROUP BY theme
  ORDER BY (promoters + detractors) DESC, theme ASC;
$$;
