import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log('Testing theme hierarchy creation...');
    
    // Get promoter themes
    const promoterData = await supabase.rpc('themes_aggregate', {
      p_start_date: '2024-01-01',
      p_end_date: '2025-12-31',
      p_survey: null,
      p_title: null,
      p_nps_bucket: 'promoter'
    });
    
    // Get detractor themes
    const detractorData = await supabase.rpc('themes_aggregate', {
      p_start_date: '2024-01-01',
      p_end_date: '2025-12-31',
      p_survey: null,
      p_title: null,
      p_nps_bucket: 'detractor'
    });
    
    console.log('Raw promoter themes:', promoterData.data?.length || 0);
    console.log('Raw detractor themes:', detractorData.data?.length || 0);
    
    // Import theme mapping functions
    const { createThemeHierarchy } = await import('@/lib/theme-mapping');
    
    // Create hierarchies
    const promoterHierarchy = createThemeHierarchy(
      (promoterData.data || []).map(t => ({
        theme: t.theme,
        count: t.count_responses,
        avgNps: t.avg_nps,
        sentiment: t.avg_sentiment
      }))
    );
    
    const detractorHierarchy = createThemeHierarchy(
      (detractorData.data || []).map(t => ({
        theme: t.theme,
        count: t.count_responses,
        avgNps: t.avg_nps,
        sentiment: t.avg_sentiment
      }))
    );
    
    console.log('Promoter hierarchy:', promoterHierarchy.length, promoterHierarchy);
    console.log('Detractor hierarchy:', detractorHierarchy.length, detractorHierarchy);
    
    // Filter out "Other" and get top 3
    const topPromoterSubThemes = promoterHierarchy
      .filter(h => h.main !== 'Other')
      .slice(0, 3);
    
    const topDetractorSubThemes = detractorHierarchy
      .filter(h => h.main !== 'Other')
      .slice(0, 3);
    
    console.log('Top promoter sub-themes:', topPromoterSubThemes.length, topPromoterSubThemes);
    console.log('Top detractor sub-themes:', topDetractorSubThemes.length, topDetractorSubThemes);
    
    return Response.json({
      success: true,
      rawPromoterCount: promoterData.data?.length || 0,
      rawDetractorCount: detractorData.data?.length || 0,
      promoterHierarchyCount: promoterHierarchy.length,
      detractorHierarchyCount: detractorHierarchy.length,
      topPromoterCount: topPromoterSubThemes.length,
      topDetractorCount: topDetractorSubThemes.length,
      promoterHierarchy: promoterHierarchy,
      detractorHierarchy: detractorHierarchy,
      topPromoterSubThemes: topPromoterSubThemes,
      topDetractorSubThemes: topDetractorSubThemes
    });
  } catch (err) {
    console.error('API Error:', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}
