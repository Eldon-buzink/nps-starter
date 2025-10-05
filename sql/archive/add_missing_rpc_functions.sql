-- Add missing RPC functions for the frontend

-- 1. themes_aggregate function
CREATE OR REPLACE FUNCTION themes_aggregate(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_survey TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL
)
RETURNS TABLE (
  theme TEXT,
  count_responses BIGINT,
  share_pct NUMERIC,
  avg_sentiment NUMERIC,
  avg_nps NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_responses AS (
    SELECT r.*, e.themes, e.sentiment_score
    FROM nps_response r
    LEFT JOIN nps_ai_enrichment e ON r.id = e.response_id
    WHERE 
      (p_start_date IS NULL OR r.creation_date >= p_start_date) AND
      (p_end_date IS NULL OR r.creation_date <= p_end_date) AND
      (p_survey IS NULL OR r.survey_name = p_survey) AND
      (p_title IS NULL OR r.title_text = p_title)
  ),
  theme_counts AS (
    SELECT 
      theme,
      COUNT(*) as count_responses,
      AVG(sentiment_score) as avg_sentiment,
      AVG(nps_score) as avg_nps
    FROM filtered_responses,
    LATERAL jsonb_array_elements_text(COALESCE(themes, '[]'::jsonb)) as theme
    WHERE themes IS NOT NULL AND jsonb_array_length(themes) > 0
    GROUP BY theme
  ),
  total_responses AS (
    SELECT COUNT(*) as total FROM filtered_responses
    WHERE themes IS NOT NULL AND jsonb_array_length(themes) > 0
  )
  SELECT 
    tc.theme,
    tc.count_responses,
    ROUND((tc.count_responses::NUMERIC / tr.total::NUMERIC) * 100, 2) as share_pct,
    ROUND(tc.avg_sentiment, 2) as avg_sentiment,
    ROUND(tc.avg_nps, 2) as avg_nps
  FROM theme_counts tc
  CROSS JOIN total_responses tr
  ORDER BY tc.count_responses DESC;
END;
$$ LANGUAGE plpgsql;

-- 2. nps_trend_by_title_with_mom function
CREATE OR REPLACE FUNCTION nps_trend_by_title_with_mom(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_survey TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL
)
RETURNS TABLE (
  month TEXT,
  title TEXT,
  responses BIGINT,
  nps NUMERIC,
  mom_delta NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT 
      TO_CHAR(creation_date, 'YYYY-MM') as month,
      COALESCE(title_text, 'Unknown') as title,
      COUNT(*) as responses,
      calculate_nps_score(
        COUNT(*) FILTER (WHERE nps_category = 'promoter'),
        COUNT(*) FILTER (WHERE nps_category = 'passive'),
        COUNT(*) FILTER (WHERE nps_category = 'detractor')
      ) as nps
    FROM nps_response
    WHERE 
      (p_start_date IS NULL OR creation_date >= p_start_date) AND
      (p_end_date IS NULL OR creation_date <= p_end_date) AND
      (p_survey IS NULL OR survey_name = p_survey) AND
      (p_title IS NULL OR title_text = p_title)
    GROUP BY TO_CHAR(creation_date, 'YYYY-MM'), COALESCE(title_text, 'Unknown')
  ),
  with_previous AS (
    SELECT 
      md.*,
      LAG(md.nps) OVER (PARTITION BY md.title ORDER BY md.month) as prev_nps
    FROM monthly_data md
  )
  SELECT 
    wp.month,
    wp.title,
    wp.responses,
    wp.nps,
    CASE 
      WHEN wp.prev_nps IS NOT NULL THEN wp.nps - wp.prev_nps
      ELSE NULL
    END as mom_delta
  FROM with_previous wp
  ORDER BY wp.month DESC, wp.title;
END;
$$ LANGUAGE plpgsql;

-- 3. themes_promoter_detractor function (if needed)
CREATE OR REPLACE FUNCTION themes_promoter_detractor(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_survey TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL
)
RETURNS TABLE (
  theme TEXT,
  promoters BIGINT,
  detractors BIGINT,
  passives BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_responses AS (
    SELECT r.*, e.themes
    FROM nps_response r
    LEFT JOIN nps_ai_enrichment e ON r.id = e.response_id
    WHERE 
      (p_start_date IS NULL OR r.creation_date >= p_start_date) AND
      (p_end_date IS NULL OR r.creation_date <= p_end_date) AND
      (p_survey IS NULL OR r.survey_name = p_survey) AND
      (p_title IS NULL OR r.title_text = p_title)
  ),
  theme_breakdown AS (
    SELECT 
      theme,
      COUNT(*) FILTER (WHERE nps_category = 'promoter') as promoters,
      COUNT(*) FILTER (WHERE nps_category = 'detractor') as detractors,
      COUNT(*) FILTER (WHERE nps_category = 'passive') as passives
    FROM filtered_responses,
    LATERAL jsonb_array_elements_text(COALESCE(themes, '[]'::jsonb)) as theme
    WHERE themes IS NOT NULL AND jsonb_array_length(themes) > 0
    GROUP BY theme
  )
  SELECT 
    tb.theme,
    tb.promoters,
    tb.detractors,
    tb.passives
  FROM theme_breakdown tb
  ORDER BY (tb.promoters + tb.detractors + tb.passives) DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION themes_aggregate TO anon, authenticated;
GRANT EXECUTE ON FUNCTION nps_trend_by_title_with_mom TO anon, authenticated;
GRANT EXECUTE ON FUNCTION themes_promoter_detractor TO anon, authenticated;
