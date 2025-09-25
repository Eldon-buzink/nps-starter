-- Simple script to fix the nps_ai_enrichment table schema
-- Run this directly in your Supabase SQL editor

-- Add missing columns
ALTER TABLE nps_ai_enrichment 
ADD COLUMN IF NOT EXISTS sentiment_score FLOAT;

ALTER TABLE nps_ai_enrichment 
ADD COLUMN IF NOT EXISTS sentiment_label TEXT;

ALTER TABLE nps_ai_enrichment 
ADD COLUMN IF NOT EXISTS keywords TEXT[];

ALTER TABLE nps_ai_enrichment 
ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE nps_ai_enrichment 
ADD COLUMN IF NOT EXISTS ai_model TEXT;

ALTER TABLE nps_ai_enrichment 
ADD COLUMN IF NOT EXISTS processing_status TEXT;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'nps_ai_enrichment' 
ORDER BY ordinal_position;
