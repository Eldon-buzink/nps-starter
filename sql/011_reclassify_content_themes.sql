-- Reclassify specific themes from 'overige' to 'content_kwaliteit'
-- This script targets themes that should be under Content Quality

-- Update themes that are clearly content-related
UPDATE nps_ai_enrichment 
SET themes = 'content_kwaliteit'
WHERE themes = 'overige' 
AND (
  -- Language and writing errors
  LOWER(nps_explanation) LIKE '%taal%' 
  OR LOWER(nps_explanation) LIKE '%schrijffout%'
  OR LOWER(nps_explanation) LIKE '%spelling%'
  OR LOWER(nps_explanation) LIKE '%grammatica%'
  OR LOWER(nps_explanation) LIKE '%fout%'
  
  -- Content relevance
  OR LOWER(nps_explanation) LIKE '%relevantie%'
  OR LOWER(nps_explanation) LIKE '%relevant%'
  OR LOWER(nps_explanation) LIKE '%inhoud%'
  
  -- Sensationalism
  OR LOWER(nps_explanation) LIKE '%sensatie%'
  OR LOWER(nps_explanation) LIKE '%dramatisch%'
  OR LOWER(nps_explanation) LIKE '%drama%'
  
  -- General content quality terms
  OR LOWER(nps_explanation) LIKE '%kwaliteit%'
  OR LOWER(nps_explanation) LIKE '%artikel%'
  OR LOWER(nps_explanation) LIKE '%verhaal%'
  OR LOWER(nps_explanation) LIKE '%tekst%'
  OR LOWER(nps_explanation) LIKE '%nieuws%'
  OR LOWER(nps_explanation) LIKE '%redactie%'
  OR LOWER(nps_explanation) LIKE '%journalistiek%'
);

-- Show the results
SELECT 
  'Before' as status,
  themes,
  COUNT(*) as count
FROM nps_ai_enrichment 
WHERE themes IN ('overige', 'content_kwaliteit')
GROUP BY themes
ORDER BY themes;
