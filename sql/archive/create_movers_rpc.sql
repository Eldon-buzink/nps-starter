-- Create the top_title_mom_moves RPC function for NPS movers analysis

CREATE OR REPLACE FUNCTION top_title_mom_moves(
  p_start_date DATE DEFAULT NULL,
  p_end_date   DATE DEFAULT NULL,
  p_survey     TEXT DEFAULT NULL,
  p_title      TEXT DEFAULT NULL,
  p_min_responses INT DEFAULT 30,
  p_top_k      INT DEFAULT 5
)
RETURNS TABLE(
  title_text TEXT,
  current_nps NUMERIC,
  previous_nps NUMERIC,
  delta NUMERIC,
  current_responses INT,
  previous_responses INT
)
LANGUAGE SQL STABLE AS $$
  WITH monthly_data AS (
    SELECT 
      title_text,
      DATE_TRUNC('month', creation_date)::DATE as month,
      COUNT(*) as responses,
      ROUND(((SUM(CASE WHEN nps_score >= 9 THEN 1 ELSE 0 END)
           -  SUM(CASE WHEN nps_score <= 6 THEN 1 ELSE 0 END)) * 100.0)
           / NULLIF(COUNT(*),0), 1) AS nps
    FROM nps_response
    WHERE (p_start_date IS NULL OR creation_date >= p_start_date)
      AND (p_end_date IS NULL OR creation_date < p_end_date + INTERVAL '1 day')
      AND (p_survey IS NULL OR survey_name = p_survey)
      AND (p_title IS NULL OR title_text = p_title)
      AND title_text IS NOT NULL
    GROUP BY title_text, DATE_TRUNC('month', creation_date)::DATE
    HAVING COUNT(*) >= p_min_responses
  ),
  ranked_months AS (
    SELECT 
      month,
      ROW_NUMBER() OVER (ORDER BY month DESC) as month_rank
    FROM monthly_data
    GROUP BY month
  ),
  current_month AS (
    SELECT month FROM ranked_months WHERE month_rank = 1
  ),
  previous_month AS (
    SELECT month FROM ranked_months WHERE month_rank = 2
  ),
  movers AS (
    SELECT 
      c.title_text,
      c.nps as current_nps,
      p.nps as previous_nps,
      ROUND(c.nps - p.nps, 1) as delta,
      c.responses as current_responses,
      p.responses as previous_responses
    FROM monthly_data c
    CROSS JOIN current_month cm
    CROSS JOIN previous_month pm
    LEFT JOIN monthly_data p ON p.title_text = c.title_text AND p.month = pm.month
    WHERE c.month = cm.month
      AND p.month IS NOT NULL
      AND ABS(c.nps - p.nps) >= 5.0  -- Significant change threshold
  )
  SELECT 
    title_text,
    current_nps,
    previous_nps,
    delta,
    current_responses,
    previous_responses
  FROM movers
  ORDER BY ABS(delta) DESC, title_text ASC
  LIMIT p_top_k;
$$;
