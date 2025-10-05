-- Fix filter options with proper views

-- Survey types (trimmed and deduped)
CREATE OR REPLACE VIEW v_filter_surveys AS
SELECT DISTINCT TRIM(survey_name) as survey_name
FROM nps_response 
WHERE survey_name IS NOT NULL AND TRIM(survey_name) != ''
ORDER BY survey_name ASC;

-- Titles (trimmed and deduped)
CREATE OR REPLACE VIEW v_filter_titles AS
SELECT DISTINCT TRIM(title_text) as title_text
FROM nps_response 
WHERE title_text IS NOT NULL AND TRIM(title_text) != ''
ORDER BY title_text ASC;

-- Grant permissions
GRANT SELECT ON v_filter_surveys TO anon, authenticated;
GRANT SELECT ON v_filter_titles TO anon, authenticated;
