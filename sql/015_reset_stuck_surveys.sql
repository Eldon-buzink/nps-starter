-- Check for stuck surveys and reset them
-- This will help if surveys are stuck in 'processing' status

-- First, check current status
SELECT 
  id,
  name,
  status,
  total_responses,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_since_update
FROM survey_analyses 
WHERE status = 'processing'
ORDER BY created_at DESC;

-- Reset surveys that have been stuck for more than 10 minutes
UPDATE survey_analyses 
SET status = 'failed', 
    updated_at = NOW()
WHERE status = 'processing' 
AND updated_at < NOW() - INTERVAL '10 minutes';

-- Show the results
SELECT 
  'Reset completed' as action,
  COUNT(*) as surveys_reset
FROM survey_analyses 
WHERE status = 'failed' 
AND updated_at > NOW() - INTERVAL '1 minute';
