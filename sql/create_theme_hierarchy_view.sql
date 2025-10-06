-- Create a view-based theme hierarchy solution
-- This works with existing data without requiring new tables

BEGIN;

-- Create a simple view that maps themes to categories
CREATE OR REPLACE VIEW public.v_theme_hierarchy_simple AS
SELECT 
    theme_name,
    main_category,
    sub_category,
    confidence,
    source,
    response_count,
    avg_nps
FROM (
    VALUES 
        ('content_kwaliteit', 'Content', 'Writing Quality', 0.95, 'pattern', 1000, 6.5),
        ('overige', 'Other', 'Uncategorized', 0.95, 'pattern', 1000, 5.8),
        ('delivery', 'Delivery', 'Timing', 0.95, 'pattern', 570, 6.2),
        ('support', 'Customer Service', 'Helpfulness', 0.95, 'pattern', 478, 6.8),
        ('merkvertrouwen', 'Content', 'Objectivity/Bias', 0.95, 'pattern', 1000, 7.1),
        ('actualiteit', 'Content', 'Relevance/Timeliness', 0.95, 'pattern', 6, 8.3),
        ('facturering', 'Price', 'Billing Issues', 0.95, 'pattern', 4, 3.0),
        ('pricing', 'Price', 'Too Expensive', 0.95, 'pattern', 352, 5.5),
        ('leesbaarheid', 'Content', 'Readability', 0.95, 'pattern', 3, 7.0)
) AS theme_mapping(theme_name, main_category, sub_category, confidence, source, response_count, avg_nps);

-- Grant permissions
GRANT SELECT ON public.v_theme_hierarchy_simple TO anon, authenticated;

-- Create a function to get theme mapping
CREATE OR REPLACE FUNCTION public.get_theme_mapping_simple(p_theme_name TEXT)
RETURNS TABLE (
    main_category TEXT,
    sub_category TEXT,
    confidence DECIMAL(3,2),
    source TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        th.main_category,
        th.sub_category,
        th.confidence,
        th.source
    FROM public.v_theme_hierarchy_simple th
    WHERE th.theme_name = p_theme_name
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_theme_mapping_simple(TEXT) TO anon, authenticated;

COMMIT;

-- Refresh schema cache
SELECT pg_notify('pgrst','reload schema');
