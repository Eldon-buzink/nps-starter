import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log('Testing detailed theme hierarchy...');
    
    // Get promoter themes
    const promoterData = await supabase.rpc('themes_aggregate', {
      p_start_date: '2024-01-01',
      p_end_date: '2025-12-31',
      p_survey: null,
      p_title: null,
      p_nps_bucket: 'promoter'
    });
    
    // Import theme mapping functions
    const { createThemeHierarchy } = await import('@/lib/theme-mapping');
    
    // Create hierarchy
    const promoterHierarchy = createThemeHierarchy(
      (promoterData.data || []).map(t => ({
        theme: t.theme,
        count: t.count_responses,
        avgNps: t.avg_nps,
        sentiment: t.avg_sentiment
      }))
    );
    
    console.log('Full promoter hierarchy:', promoterHierarchy.length, 'items');
    console.log('First 10 promoter hierarchy items:', promoterHierarchy.slice(0, 10));
    
    // Filter out "Other" and show what's available
    const filteredPromoter = promoterHierarchy.filter(h => h.main !== 'Other');
    console.log('After filtering out Other:', filteredPromoter.length, 'items');
    console.log('First 10 filtered promoter items:', filteredPromoter.slice(0, 10));
    
    return Response.json({
      success: true,
      totalHierarchyItems: promoterHierarchy.length,
      afterFilteringItems: filteredPromoter.length,
      first10Hierarchy: promoterHierarchy.slice(0, 10),
      first10Filtered: filteredPromoter.slice(0, 10),
      allFiltered: filteredPromoter
    });
  } catch (err) {
    console.error('API Error:', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}
