-- Fix the v_nps_monthly view to use creation_date instead of created_at
-- This will enable proper month-over-month calculations

CREATE OR REPLACE VIEW v_nps_monthly AS
SELECT
  date_trunc('month', creation_date)::date as month,
  title_text as title,
  survey_name as survey_type,
  nps_score
FROM nps_response
WHERE creation_date is not null;

-- Test the view to see what months we have data for
SELECT 
  month,
  COUNT(*) as responses,
  COUNT(DISTINCT title) as titles
FROM v_nps_monthly 
GROUP BY month 
ORDER BY month;
