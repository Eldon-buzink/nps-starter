-- Check if nps_ai_enrichment table exists and create if needed
-- This script ensures the table has the correct schema for AI enrichment

-- First, check if table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'nps_ai_enrichment') THEN
        -- Create the table if it doesn't exist
        CREATE TABLE nps_ai_enrichment (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            response_id UUID NOT NULL REFERENCES nps_response(id) ON DELETE CASCADE,
            sentiment_score FLOAT,
            sentiment_label TEXT,
            promoter_flag BOOLEAN DEFAULT FALSE,
            passive_flag BOOLEAN DEFAULT FALSE,
            detractor_flag BOOLEAN DEFAULT FALSE,
            themes TEXT[] DEFAULT '{}',
            theme_scores JSONB DEFAULT '{}',
            keywords TEXT[] DEFAULT '{}',
            language TEXT DEFAULT 'nl',
            embedding_vector VECTOR(1536),
            summary TEXT,
            ai_model TEXT,
            processing_status TEXT DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes
        CREATE INDEX idx_nps_ai_enrichment_response_id ON nps_ai_enrichment(response_id);
        CREATE INDEX idx_nps_ai_enrichment_sentiment ON nps_ai_enrichment(sentiment_score);
        CREATE INDEX idx_nps_ai_enrichment_themes ON nps_ai_enrichment USING GIN(themes);
        CREATE INDEX idx_nps_ai_enrichment_vector ON nps_ai_enrichment USING ivfflat(embedding_vector vector_cosine_ops) WITH (lists = 100);
        
        RAISE NOTICE 'Created nps_ai_enrichment table';
    ELSE
        RAISE NOTICE 'nps_ai_enrichment table already exists';
    END IF;
END $$;

-- Add missing columns if they don't exist
ALTER TABLE nps_ai_enrichment ADD COLUMN IF NOT EXISTS sentiment_score FLOAT;
ALTER TABLE nps_ai_enrichment ADD COLUMN IF NOT EXISTS sentiment_label TEXT;
ALTER TABLE nps_ai_enrichment ADD COLUMN IF NOT EXISTS keywords TEXT[];
ALTER TABLE nps_ai_enrichment ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE nps_ai_enrichment ADD COLUMN IF NOT EXISTS ai_model TEXT;
ALTER TABLE nps_ai_enrichment ADD COLUMN IF NOT EXISTS processing_status TEXT;

-- Disable RLS for now to allow inserts
ALTER TABLE nps_ai_enrichment DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON nps_ai_enrichment TO postgres, authenticated, anon, service_role;

-- Show table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'nps_ai_enrichment' 
ORDER BY ordinal_position;
