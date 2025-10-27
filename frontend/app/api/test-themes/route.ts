import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log('Testing themes_aggregate RPC...');
    
    const [promoterData, detractorData] = await Promise.all([
      supabase.rpc('themes_aggregate', {
        p_start_date: '2024-01-01',
        p_end_date: '2025-12-31',
        p_survey: null,
        p_title: null,
        p_nps_bucket: 'promoter'
      }),
      supabase.rpc('themes_aggregate', {
        p_start_date: '2024-01-01',
        p_end_date: '2025-12-31',
        p_survey: null,
        p_title: null,
        p_nps_bucket: 'detractor'
      })
    ]);
    
    console.log('Promoter themes:', promoterData.data?.length || 0, promoterData.data);
    console.log('Detractor themes:', detractorData.data?.length || 0, detractorData.data);
    
    return Response.json({
      success: true,
      promoterThemes: promoterData.data || [],
      detractorThemes: detractorData.data || [],
      promoterCount: promoterData.data?.length || 0,
      detractorCount: detractorData.data?.length || 0
    });
  } catch (err) {
    console.error('API Error:', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}
