import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log('Testing top_title_mom_moves with top_k=10...');
    
    const { data, error } = await supabase.rpc('top_title_mom_moves', {
      p_start_date: '2024-01-01',
      p_end_date: '2025-12-31',
      p_survey: null,
      p_min_responses: 10,
      p_top_k: 10
    });
    
    console.log('RPC Response:', { data, error });
    
    if (data) {
      const improvers = data.filter((item: any) => item.delta > 0);
      const decliners = data.filter((item: any) => item.delta < 0);
      
      console.log('Improvers:', improvers.length, improvers);
      console.log('Decliners:', decliners.length, decliners);
    }
    
    return Response.json({
      success: true,
      data: data,
      error: error,
      dataLength: data?.length || 0,
      improvers: data?.filter((item: any) => item.delta > 0) || [],
      decliners: data?.filter((item: any) => item.delta < 0) || []
    });
  } catch (err) {
    console.error('API Error:', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}