-- Reclassify specific themes from 'overige' to 'content_kwaliteit'
-- This script targets themes that should be under Content Quality

-- Update themes that are clearly content-related
UPDATE nps_ai_enrichment 
SET themes = ARRAY['content_kwaliteit']
WHERE 'overige' = ANY(themes)
AND (
  -- Language and writing errors
  LOWER(summary) LIKE '%taal%' 
  OR LOWER(summary) LIKE '%schrijffout%'
  OR LOWER(summary) LIKE '%spelling%'
  OR LOWER(summary) LIKE '%grammatica%'
  OR LOWER(summary) LIKE '%fout%'
  
  -- Content relevance
  OR LOWER(summary) LIKE '%relevantie%'
  OR LOWER(summary) LIKE '%relevant%'
  OR LOWER(summary) LIKE '%inhoud%'
  
  -- Sensationalism
  OR LOWER(summary) LIKE '%sensatie%'
  OR LOWER(summary) LIKE '%dramatisch%'
  OR LOWER(summary) LIKE '%drama%'
  
  -- General content quality terms
  OR LOWER(summary) LIKE '%kwaliteit%'
  OR LOWER(summary) LIKE '%artikel%'
  OR LOWER(summary) LIKE '%verhaal%'
  OR LOWER(summary) LIKE '%tekst%'
  OR LOWER(summary) LIKE '%nieuws%'
  OR LOWER(summary) LIKE '%redactie%'
  OR LOWER(summary) LIKE '%journalistiek%'
);

-- Show the results
SELECT 
  'After' as status,
  unnest(themes) as theme,
  COUNT(*) as count
FROM nps_ai_enrichment 
WHERE 'overige' = ANY(themes) OR 'content_kwaliteit' = ANY(themes)
GROUP BY unnest(themes)
ORDER BY theme;
