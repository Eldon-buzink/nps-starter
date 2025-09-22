# Data Model

## Overview

The NPS Insights Tool uses a normalized database schema designed for scalability and performance. The model follows a three-tier approach: Raw Data → Processed Data → Analytics.

## Core Tables

### 1. nps_raw
Stores the original CSV data before processing.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| survey_name | VARCHAR(255) | Name of the survey |
| nps_score | INTEGER | NPS score (0-10) |
| nps_explanation | TEXT | Free text explanation |
| gender | VARCHAR(50) | Respondent gender |
| age_range | VARCHAR(50) | Age range |
| years_employed | VARCHAR(50) | Years at company |
| creation_date | DATE | Response date |
| title_text | VARCHAR(255) | Job title/position |
| raw_data | JSONB | Original CSV row data |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

### 2. nps_response
Processed and validated NPS responses.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| raw_id | UUID | Reference to nps_raw |
| survey_name | VARCHAR(255) | Survey name |
| nps_score | INTEGER | NPS score (0-10) |
| nps_explanation | TEXT | Explanation text |
| gender | VARCHAR(50) | Gender |
| age_range | VARCHAR(50) | Age range |
| years_employed | VARCHAR(50) | Employment duration |
| creation_date | DATE | Response date |
| title_text | VARCHAR(255) | Job title |
| nps_category | VARCHAR(20) | promoter/passive/detractor |
| word_count | INTEGER | Explanation word count |
| has_explanation | BOOLEAN | Has explanation text |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Update time |

### 3. nps_ai_enrichment
AI-generated insights for each response.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| response_id | UUID | Reference to nps_response |
| themes | JSONB | Array of identified themes |
| sentiment_score | DECIMAL(3,2) | Sentiment score (-1.0 to 1.0) |
| sentiment_label | VARCHAR(20) | positive/negative/neutral |
| keywords | JSONB | Array of keywords |
| summary | TEXT | AI-generated summary |
| ai_model | VARCHAR(100) | AI model used |
| processing_status | VARCHAR(20) | pending/processing/completed/failed |
| error_message | TEXT | Error details if failed |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Update time |

### 4. nps_daily_rollup
Pre-computed daily aggregations for performance.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| survey_name | VARCHAR(255) | Survey name |
| rollup_date | DATE | Aggregation date |
| total_responses | INTEGER | Total responses |
| promoters | INTEGER | Promoter count |
| passives | INTEGER | Passive count |
| detractors | INTEGER | Detractor count |
| nps_score | DECIMAL(5,2) | Calculated NPS score |
| gender_breakdown | JSONB | Gender distribution |
| age_breakdown | JSONB | Age distribution |
| employment_breakdown | JSONB | Employment distribution |
| top_themes | JSONB | Most common themes |
| sentiment_distribution | JSONB | Sentiment breakdown |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Update time |

## Views

### 1. nps_summary
Main view joining all response data with AI enrichment.

### 2. nps_survey_metrics
Aggregated metrics by survey.

### 3. nps_daily_trends
Daily trend analysis.

### 4. nps_theme_analysis
Theme frequency and sentiment analysis.

### 5. nps_demographics
Demographic breakdown of responses.

### 6. nps_recent_responses
Recent responses (last 30 days).

## Functions

### 1. categorize_nps_score(score INTEGER)
Automatically categorizes NPS scores into promoter/passive/detractor.

### 2. calculate_nps_score(promoters INTEGER, detractors INTEGER, total INTEGER)
Calculates NPS score from counts.

### 3. update_updated_at_column()
Trigger function to update timestamps.

## Indexes

- Primary keys on all tables
- Foreign key indexes
- Survey name indexes for filtering
- Date indexes for time-based queries
- Category indexes for NPS analysis

## Relationships

```
nps_raw (1) → (1) nps_response (1) → (1) nps_ai_enrichment
nps_response (N) → (1) nps_daily_rollup
```

## Data Validation

- NPS scores must be 0-10
- NPS categories must be valid enum values
- Sentiment scores must be -1.0 to 1.0
- Required fields are enforced at database level
