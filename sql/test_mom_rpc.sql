-- Test the top_title_mom_moves RPC function directly
-- This will help us debug why it's not returning data

-- First, let's check what the v_nps_monthly view returns
SELECT 
  month,
  title,
  COUNT(*) as responses,
  AVG(nps_score) as avg_nps
FROM v_nps_monthly 
WHERE month >= '2024-01-01' AND month <= '2025-12-31'
GROUP BY month, title
ORDER BY month DESC, responses DESC
LIMIT 20;

-- Now test the RPC function
SELECT * FROM top_title_mom_moves(
  p_start_date := '2024-01-01',
  p_end_date := '2025-12-31',
  p_min_responses := 10,
  p_top_k := 5
);
