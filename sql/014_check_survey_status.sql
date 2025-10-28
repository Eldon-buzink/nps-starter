-- Check recent survey analyses and their status
SELECT 
  id,
  name,
  status,
  total_responses,
  created_at,
  updated_at
FROM survey_analyses 
ORDER BY created_at DESC 
LIMIT 5;
