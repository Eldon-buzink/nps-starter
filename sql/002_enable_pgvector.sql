-- Enable pgvector extension for vector search
-- Run this AFTER the minimal setup is working

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS "vector";

-- Add vector column to nps_ai_enrichment
ALTER TABLE nps_ai_enrichment 
ADD COLUMN embedded_vector VECTOR(1536);

-- Create vector index for similarity search
CREATE INDEX idx_enrich_vector ON nps_ai_enrichment 
USING ivfflat (embedded_vector vector_cosine_ops) 
WITH (lists = 100);

-- Update the vector search functions to use proper vector operations
CREATE OR REPLACE FUNCTION similar_responses_by_vector(
  p_query vector(1536),
  p_limit int default 10
)
RETURNS TABLE(
  response_id uuid,
  title text,
  survey_type text,
  created_at date,
  nps_score int,
  comment text,
  similarity numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id as response_id,
    r.title_text as title,
    r.survey_name as survey_type,
    r.creation_date as created_at,
    r.nps_score,
    r.nps_explanation as comment,
    (1 - (e.embedded_vector <=> p_query))::numeric as similarity
  FROM nps_response r
  JOIN nps_ai_enrichment e ON e.response_id = r.id
  WHERE e.embedded_vector IS NOT NULL
  ORDER BY e.embedded_vector <=> p_query
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION similar_responses_for_response(
  p_response_id uuid,
  p_limit int default 10
)
RETURNS TABLE(
  response_id uuid,
  title text,
  survey_type text,
  created_at date,
  nps_score int,
  comment text,
  similarity numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id as response_id,
    r.title_text as title,
    r.survey_name as survey_type,
    r.creation_date as created_at,
    r.nps_score,
    r.nps_explanation as comment,
    (1 - (e.embedded_vector <=> (SELECT embedded_vector FROM nps_ai_enrichment WHERE response_id = p_response_id)))::numeric as similarity
  FROM nps_response r
  JOIN nps_ai_enrichment e ON e.response_id = r.id
  WHERE e.embedded_vector IS NOT NULL
    AND r.id <> p_response_id
  ORDER BY e.embedded_vector <=> (SELECT embedded_vector FROM nps_ai_enrichment WHERE response_id = p_response_id)
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
