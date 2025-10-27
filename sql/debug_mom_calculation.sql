-- Debug the month-over-month calculation step by step

-- Step 1: Check what months we have data for
SELECT 
  month,
  COUNT(*) as total_responses,
  COUNT(DISTINCT title) as unique_titles
FROM v_nps_monthly 
GROUP BY month 
ORDER BY month DESC;

-- Step 2: Test the nps_trend_by_title_with_mom function
SELECT * FROM nps_trend_by_title_with_mom(
  p_start_date := '2024-01-01',
  p_end_date := '2025-12-31',
  p_survey := null,
  p_title := null
)
ORDER BY month DESC, title
LIMIT 20;

-- Step 3: Check what the latest month logic finds
WITH series AS (
  SELECT * FROM nps_trend_by_title_with_mom('2024-01-01', '2025-12-31', null, null)
),
latest AS (
  SELECT max(month) as latest_month FROM series
)
SELECT 
  s.*,
  l.latest_month,
  CASE WHEN s.month = l.latest_month THEN 'LATEST' ELSE 'PREVIOUS' END as month_type
FROM series s
CROSS JOIN latest l
WHERE s.month >= l.latest_month - INTERVAL '1 month'
ORDER BY s.month DESC, s.title;
