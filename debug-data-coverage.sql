-- Test script to check what data is actually in the database
-- Run this in Supabase SQL Editor to debug the data coverage issue

-- Check total responses
SELECT COUNT(*) as total_responses FROM nps_response;

-- Check date ranges in both columns
SELECT 
  'creation_date' as column_name,
  MIN(creation_date) as min_date,
  MAX(creation_date) as max_date,
  COUNT(*) as count
FROM nps_response
WHERE creation_date IS NOT NULL

UNION ALL

SELECT 
  'created_at' as column_name,
  MIN(created_at::date) as min_date,
  MAX(created_at::date) as max_date,
  COUNT(*) as count
FROM nps_response
WHERE created_at IS NOT NULL;

-- Check responses with comments
SELECT COUNT(*) as responses_with_comments 
FROM nps_response 
WHERE nps_explanation IS NOT NULL 
  AND nps_explanation != '';

-- Check enriched responses
SELECT COUNT(*) as enriched_responses 
FROM nps_ai_enrichment 
WHERE themes IS NOT NULL 
  AND sentiment_score IS NOT NULL;

-- Sample some actual data
SELECT 
  creation_date,
  created_at,
  nps_score,
  nps_explanation,
  title_text
FROM nps_response 
LIMIT 5;
