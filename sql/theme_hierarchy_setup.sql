-- Theme Hierarchy Setup
-- Creates tables and views for hierarchical theme structure

BEGIN;

-- 1. Create theme hierarchy mapping table
CREATE TABLE IF NOT EXISTS public.theme_hierarchy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_theme TEXT NOT NULL,
    main_category TEXT NOT NULL,
    sub_category TEXT NOT NULL,
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    source TEXT CHECK (source IN ('pattern', 'ai', 'fallback')),
    response_count INTEGER DEFAULT 0,
    avg_nps DECIMAL(4,2),
    sample_responses JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint on original theme
    UNIQUE(original_theme)
);

-- 2. Create main categories table
CREATE TABLE IF NOT EXISTS public.theme_main_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    color TEXT, -- For UI theming
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create sub categories table
CREATE TABLE IF NOT EXISTS public.theme_sub_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    main_category_id UUID REFERENCES public.theme_main_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint on main_category + name
    UNIQUE(main_category_id, name)
);

-- 4. Insert default main categories
INSERT INTO public.theme_main_categories (name, display_name, description, color, sort_order) VALUES
('Content', 'Content', 'Content quality, writing, relevance, and editorial aspects', '#3B82F6', 1),
('Price', 'Price', 'Pricing, billing, and cost-related feedback', '#10B981', 2),
('Delivery', 'Delivery', 'Delivery process, timing, and packaging', '#F59E0B', 3),
('Customer Service', 'Customer Service', 'Customer support and service quality', '#EF4444', 4),
('User Experience', 'User Experience', 'Interface, navigation, and usability', '#8B5CF6', 5),
('Other', 'Other', 'Uncategorized or miscellaneous feedback', '#6B7280', 6)
ON CONFLICT (name) DO NOTHING;

-- 5. Insert default sub categories
WITH main_cats AS (
    SELECT id, name FROM public.theme_main_categories
)
INSERT INTO public.theme_sub_categories (main_category_id, name, display_name, description, sort_order)
SELECT 
    mc.id,
    sub_data.name,
    sub_data.display_name,
    sub_data.description,
    sub_data.sort_order
FROM main_cats mc
CROSS JOIN (VALUES
    -- Content subcategories
    ('Content', 'Writing Quality', 'Writing Quality', 'General content writing and editorial quality', 1),
    ('Content', 'Relevance/Timeliness', 'Relevance/Timeliness', 'Content relevance and timeliness', 2),
    ('Content', 'Readability', 'Readability', 'Content readability and clarity', 3),
    ('Content', 'Objectivity/Bias', 'Objectivity/Bias', 'Content objectivity and bias concerns', 4),
    ('Content', 'General Quality', 'General Quality', 'General content quality issues', 5),
    
    -- Price subcategories
    ('Price', 'Cost', 'Cost', 'General pricing and cost concerns', 1),
    ('Price', 'Too Expensive', 'Too Expensive', 'Feedback about high prices', 2),
    ('Price', 'Billing Issues', 'Billing Issues', 'Billing and invoicing problems', 3),
    ('Price', 'Payment Process', 'Payment Process', 'Payment process and methods', 4),
    
    -- Delivery subcategories
    ('Delivery', 'Timing', 'Timing', 'General delivery timing issues', 1),
    ('Delivery', 'Delivery Speed', 'Delivery Speed', 'Slow or fast delivery feedback', 2),
    ('Delivery', 'Delivery Process', 'Delivery Process', 'Delivery process and logistics', 3),
    ('Delivery', 'Packaging', 'Packaging', 'Packaging quality and condition', 4),
    
    -- Customer Service subcategories
    ('Customer Service', 'Helpfulness', 'Helpfulness', 'Customer service helpfulness', 1),
    ('Customer Service', 'Service Quality', 'Service Quality', 'Overall service quality', 2),
    ('Customer Service', 'Communication', 'Communication', 'Communication and contact quality', 3),
    ('Customer Service', 'Response Time', 'Response Time', 'Response time and speed', 4),
    
    -- User Experience subcategories
    ('User Experience', 'Interface Design', 'Interface Design', 'Interface and design feedback', 1),
    ('User Experience', 'Navigation', 'Navigation', 'Navigation and user flow', 2),
    ('User Experience', 'Usability', 'Usability', 'General usability concerns', 3),
    
    -- Other subcategories
    ('Other', 'Uncategorized', 'Uncategorized', 'Uncategorized feedback', 1)
) AS sub_data(main_name, name, display_name, description, sort_order)
WHERE mc.name = sub_data.main_name
ON CONFLICT (main_category_id, name) DO NOTHING;

-- 6. Create view for hierarchical theme data
CREATE OR REPLACE VIEW public.v_theme_hierarchy AS
SELECT 
    th.id,
    th.original_theme,
    th.main_category,
    th.sub_category,
    th.confidence,
    th.source,
    th.response_count,
    th.avg_nps,
    th.sample_responses,
    mc.display_name as main_category_display,
    mc.color as main_category_color,
    sc.display_name as sub_category_display,
    sc.description as sub_category_description,
    th.created_at,
    th.updated_at
FROM public.theme_hierarchy th
LEFT JOIN public.theme_main_categories mc ON th.main_category = mc.name
LEFT JOIN public.theme_sub_categories sc ON th.sub_category = sc.name AND mc.id = sc.main_category_id
ORDER BY mc.sort_order, sc.sort_order, th.response_count DESC;

-- 7. Create view for theme statistics
CREATE OR REPLACE VIEW public.v_theme_hierarchy_stats AS
SELECT 
    th.main_category,
    th.sub_category,
    mc.display_name as main_category_display,
    mc.color as main_category_color,
    sc.display_name as sub_category_display,
    COUNT(*) as total_themes,
    SUM(th.response_count) as total_responses,
    AVG(th.avg_nps) as avg_nps,
    AVG(th.confidence) as avg_confidence,
    COUNT(CASE WHEN th.source = 'pattern' THEN 1 END) as pattern_mapped,
    COUNT(CASE WHEN th.source = 'ai' THEN 1 END) as ai_mapped,
    COUNT(CASE WHEN th.source = 'fallback' THEN 1 END) as fallback_mapped
FROM public.theme_hierarchy th
LEFT JOIN public.theme_main_categories mc ON th.main_category = mc.name
LEFT JOIN public.theme_sub_categories sc ON th.sub_category = sc.name AND mc.id = sc.main_category_id
GROUP BY th.main_category, th.sub_category, mc.display_name, mc.color, sc.display_name
ORDER BY mc.sort_order, sc.sort_order, SUM(th.response_count) DESC;

-- 8. Create function to get theme mapping
CREATE OR REPLACE FUNCTION public.get_theme_mapping(p_theme_name TEXT)
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
    FROM public.theme_hierarchy th
    WHERE th.original_theme = p_theme_name
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to get hierarchical theme data
CREATE OR REPLACE FUNCTION public.get_hierarchical_themes()
RETURNS TABLE (
    main_category TEXT,
    sub_category TEXT,
    theme_name TEXT,
    response_count INTEGER,
    avg_nps DECIMAL(4,2),
    confidence DECIMAL(3,2),
    source TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        th.main_category,
        th.sub_category,
        th.original_theme as theme_name,
        th.response_count,
        th.avg_nps,
        th.confidence,
        th.source
    FROM public.theme_hierarchy th
    ORDER BY th.main_category, th.sub_category, th.response_count DESC;
END;
$$ LANGUAGE plpgsql;

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_theme_hierarchy_original_theme ON public.theme_hierarchy(original_theme);
CREATE INDEX IF NOT EXISTS idx_theme_hierarchy_main_category ON public.theme_hierarchy(main_category);
CREATE INDEX IF NOT EXISTS idx_theme_hierarchy_sub_category ON public.theme_hierarchy(sub_category);
CREATE INDEX IF NOT EXISTS idx_theme_hierarchy_confidence ON public.theme_hierarchy(confidence);
CREATE INDEX IF NOT EXISTS idx_theme_hierarchy_source ON public.theme_hierarchy(source);

-- 11. Grant permissions
GRANT SELECT ON public.theme_hierarchy TO anon, authenticated;
GRANT SELECT ON public.theme_main_categories TO anon, authenticated;
GRANT SELECT ON public.theme_sub_categories TO anon, authenticated;
GRANT SELECT ON public.v_theme_hierarchy TO anon, authenticated;
GRANT SELECT ON public.v_theme_hierarchy_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_theme_mapping(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hierarchical_themes() TO anon, authenticated;

COMMIT;

-- Refresh schema cache
SELECT pg_notify('pgrst','reload schema');
