-- Frontend Database Functions
-- These functions are needed for the frontend to display real data

-- ==============================================
-- 1. BASIC NPS SUMMARY FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION get_nps_summary()
RETURNS TABLE (
    total_responses BIGINT,
    nps_score NUMERIC,
    promoters BIGINT,
    passives BIGINT,
    detractors BIGINT,
    avg_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_responses,
        calculate_nps_score(
            COUNT(*) FILTER (WHERE nps_category = 'promoter'),
            COUNT(*) FILTER (WHERE nps_category = 'passive'),
            COUNT(*) FILTER (WHERE nps_category = 'detractor')
        ) as nps_score,
        COUNT(*) FILTER (WHERE nps_category = 'promoter')::BIGINT as promoters,
        COUNT(*) FILTER (WHERE nps_category = 'passive')::BIGINT as passives,
        COUNT(*) FILTER (WHERE nps_category = 'detractor')::BIGINT as detractors,
        ROUND(AVG(nps_score), 1) as avg_score
    FROM nps_response;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 2. MONTHLY NPS TRENDS FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION get_monthly_nps_trends(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    month TEXT,
    nps_score NUMERIC,
    total_responses BIGINT,
    promoters BIGINT,
    passives BIGINT,
    detractors BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TO_CHAR(DATE_TRUNC('month', creation_date), 'YYYY-MM') as month,
        calculate_nps_score(
            COUNT(*) FILTER (WHERE nps_category = 'promoter'),
            COUNT(*) FILTER (WHERE nps_category = 'passive'),
            COUNT(*) FILTER (WHERE nps_category = 'detractor')
        ) as nps_score,
        COUNT(*)::BIGINT as total_responses,
        COUNT(*) FILTER (WHERE nps_category = 'promoter')::BIGINT as promoters,
        COUNT(*) FILTER (WHERE nps_category = 'passive')::BIGINT as passives,
        COUNT(*) FILTER (WHERE nps_category = 'detractor')::BIGINT as detractors
    FROM nps_response
    WHERE (p_start_date IS NULL OR creation_date >= p_start_date)
      AND (p_end_date IS NULL OR creation_date <= p_end_date)
    GROUP BY DATE_TRUNC('month', creation_date)
    ORDER BY month;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 3. NPS BY SURVEY FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION get_nps_by_survey()
RETURNS TABLE (
    survey_name TEXT,
    nps_score NUMERIC,
    total_responses BIGINT,
    promoters BIGINT,
    passives BIGINT,
    detractors BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        survey_name::TEXT,
        calculate_nps_score(
            COUNT(*) FILTER (WHERE nps_category = 'promoter'),
            COUNT(*) FILTER (WHERE nps_category = 'passive'),
            COUNT(*) FILTER (WHERE nps_category = 'detractor')
        ) as nps_score,
        COUNT(*)::BIGINT as total_responses,
        COUNT(*) FILTER (WHERE nps_category = 'promoter')::BIGINT as promoters,
        COUNT(*) FILTER (WHERE nps_category = 'passive')::BIGINT as passives,
        COUNT(*) FILTER (WHERE nps_category = 'detractor')::BIGINT as detractors
    FROM nps_response
    GROUP BY survey_name
    ORDER BY nps_score DESC;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 4. NPS BY TITLE FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION get_nps_by_title()
RETURNS TABLE (
    title_text TEXT,
    nps_score NUMERIC,
    total_responses BIGINT,
    promoters BIGINT,
    passives BIGINT,
    detractors BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(title_text, 'Unknown')::TEXT,
        calculate_nps_score(
            COUNT(*) FILTER (WHERE nps_category = 'promoter'),
            COUNT(*) FILTER (WHERE nps_category = 'passive'),
            COUNT(*) FILTER (WHERE nps_category = 'detractor')
        ) as nps_score,
        COUNT(*)::BIGINT as total_responses,
        COUNT(*) FILTER (WHERE nps_category = 'promoter')::BIGINT as promoters,
        COUNT(*) FILTER (WHERE nps_category = 'passive')::BIGINT as passives,
        COUNT(*) FILTER (WHERE nps_category = 'detractor')::BIGINT as detractors
    FROM nps_response
    GROUP BY title_text
    HAVING COUNT(*) >= 10  -- Only show titles with at least 10 responses
    ORDER BY nps_score DESC;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 5. RECENT RESPONSES FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION get_recent_responses(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    nps_score INTEGER,
    nps_explanation TEXT,
    survey_name TEXT,
    title_text TEXT,
    nps_category TEXT,
    creation_date DATE,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.nps_score,
        r.nps_explanation,
        r.survey_name::TEXT,
        COALESCE(r.title_text, 'Unknown')::TEXT,
        r.nps_category::TEXT,
        r.creation_date,
        r.created_at
    FROM nps_response r
    ORDER BY r.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 6. SIMPLIFIED WINNERS/LOSERS FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION get_title_mom_moves(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_min_responses INTEGER DEFAULT 30,
    p_top_k INTEGER DEFAULT 5
)
RETURNS TABLE (
    title_text TEXT,
    current_nps NUMERIC,
    previous_nps NUMERIC,
    mom_delta NUMERIC,
    current_responses BIGINT,
    previous_responses BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH monthly_data AS (
        SELECT 
            COALESCE(title_text, 'Unknown') as title_text,
            DATE_TRUNC('month', creation_date) as month,
            calculate_nps_score(
                COUNT(*) FILTER (WHERE nps_category = 'promoter'),
                COUNT(*) FILTER (WHERE nps_category = 'passive'),
                COUNT(*) FILTER (WHERE nps_category = 'detractor')
            ) as nps_score,
            COUNT(*)::BIGINT as response_count
        FROM nps_response
        WHERE (p_start_date IS NULL OR creation_date >= p_start_date)
          AND (p_end_date IS NULL OR creation_date <= p_end_date)
        GROUP BY title_text, DATE_TRUNC('month', creation_date)
        HAVING COUNT(*) >= p_min_responses
    ),
    current_month AS (
        SELECT 
            title_text,
            nps_score,
            response_count
        FROM monthly_data
        WHERE month = (SELECT MAX(month) FROM monthly_data)
    ),
    previous_month AS (
        SELECT 
            title_text,
            nps_score,
            response_count
        FROM monthly_data
        WHERE month = (SELECT MAX(month) FROM monthly_data WHERE month < (SELECT MAX(month) FROM monthly_data))
    )
    SELECT 
        c.title_text::TEXT,
        c.nps_score as current_nps,
        COALESCE(p.nps_score, 0) as previous_nps,
        (c.nps_score - COALESCE(p.nps_score, 0)) as mom_delta,
        c.response_count as current_responses,
        COALESCE(p.response_count, 0) as previous_responses
    FROM current_month c
    LEFT JOIN previous_month p ON c.title_text = p.title_text
    ORDER BY mom_delta DESC
    LIMIT p_top_k;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 7. GRANT PERMISSIONS
-- ==============================================

GRANT EXECUTE ON FUNCTION get_nps_summary() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_nps_trends(DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_nps_by_survey() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_nps_by_title() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_recent_responses(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_title_mom_moves(DATE, DATE, INTEGER, INTEGER) TO anon, authenticated;
