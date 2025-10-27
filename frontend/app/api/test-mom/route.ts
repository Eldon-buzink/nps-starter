import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log('Testing different RPC functions...');
    
    // Test 1: Check if top_title_mom_moves exists with correct signature
    const { data: momData, error: momError } = await supabase.rpc('top_title_mom_moves', {
      p_start_date: '2024-01-01',
      p_end_date: '2025-12-31',
      p_survey: null,
      p_min_responses: 10,
      p_top_k: 5
    });
    
    console.log('top_title_mom_moves result:', { data: momData, error: momError });
    
    // Test 2: Check what the actual function returns
    const { data: testData, error: testError } = await supabase.rpc('nps_trend_by_title_with_mom', {
      p_start_date: '2024-01-01',
      p_end_date: '2025-12-31',
      p_survey: null,
      p_title: null
    });
    
    console.log('nps_trend_by_title_with_mom result:', { data: testData?.slice(0, 5), error: testError });
    
    return Response.json({
      success: true,
      momData: momData,
      momError: momError,
      testData: testData?.slice(0, 5),
      testError: testError
    });
  } catch (err) {
    console.error('API Error:', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}