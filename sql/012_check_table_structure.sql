-- Check the structure of nps_ai_enrichment table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'nps_ai_enrichment'
ORDER BY ordinal_position;
