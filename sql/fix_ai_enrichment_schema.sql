-- Fix the nps_ai_enrichment table schema
-- Add missing columns for AI enrichment

-- Add sentiment_score column
ALTER TABLE nps_ai_enrichment 
ADD COLUMN IF NOT EXISTS sentiment_score FLOAT;

-- Add sentiment_label column  
ALTER TABLE nps_ai_enrichment 
ADD COLUMN IF NOT EXISTS sentiment_label TEXT;

-- Add keywords column
ALTER TABLE nps_ai_enrichment 
ADD COLUMN IF NOT EXISTS keywords TEXT[];

-- Add summary column
ALTER TABLE nps_ai_enrichment 
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add ai_model column
ALTER TABLE nps_ai_enrichment 
ADD COLUMN IF NOT EXISTS ai_model TEXT;

-- Add processing_status column
ALTER TABLE nps_ai_enrichment 
ADD COLUMN IF NOT EXISTS processing_status TEXT;

-- Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'nps_ai_enrichment' 
ORDER BY ordinal_position;
