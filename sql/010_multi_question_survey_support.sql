-- Add support for multi-question surveys
-- Add new columns to survey_analyses table

ALTER TABLE survey_analyses 
ADD COLUMN IF NOT EXISTS question_columns TEXT[],
ADD COLUMN IF NOT EXISTS is_multi_question BOOLEAN DEFAULT FALSE;

-- Update existing surveys to be single-question by default
UPDATE survey_analyses 
SET is_multi_question = FALSE 
WHERE is_multi_question IS NULL;

-- Add question context to survey_responses for multi-question support
ALTER TABLE survey_responses 
ADD COLUMN IF NOT EXISTS question_text TEXT,
ADD COLUMN IF NOT EXISTS question_order INTEGER;

-- Create index for better performance on multi-question queries
CREATE INDEX IF NOT EXISTS idx_survey_responses_question 
ON survey_responses(survey_id, question_text);

-- Update the survey_responses table to support question-specific analysis
-- This will help with per-question insights and cross-question patterns
