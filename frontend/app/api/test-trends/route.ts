import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log('Testing trends RPC functions...');
    
    // Test 1: Check nps_trend_overall RPC
    const { data: overallTrends, error: overallError } = await supabase.rpc('nps_trend_overall', {
      p_start: '2025-01-01',
      p_end: '2025-12-31',
      p_survey: null,
      p_title: null
    });
    
    console.log('Overall trends RPC result:', { overallTrends, overallError });
    
    // Test 2: Check monthly data directly
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('nps_response')
      .select('created_at, nps_score, title_text, survey_name')
      .gte('created_at', '2025-01-01')
      .lte('created_at', '2025-12-31')
      .order('created_at', { ascending: true });
    
    console.log('Monthly data sample:', { 
      count: monthlyData?.length, 
      firstFew: monthlyData?.slice(0, 5),
      error: monthlyError 
    });
    
    // Test 3: Group by month manually
    const monthlyGroups: { [key: string]: { responses: number, nps_scores: number[] } } = {};
    monthlyData?.forEach(row => {
      const month = new Date(row.created_at).toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyGroups[month]) {
        monthlyGroups[month] = { responses: 0, nps_scores: [] };
      }
      monthlyGroups[month].responses++;
      monthlyGroups[month].nps_scores.push(row.nps_score);
    });
    
    // Calculate NPS for each month
    const monthlyNps = Object.entries(monthlyGroups).map(([month, data]) => {
      const promoters = data.nps_scores.filter(score => score >= 9).length;
      const detractors = data.nps_scores.filter(score => score <= 6).length;
      const nps = data.responses > 0 ? ((promoters - detractors) / data.responses) * 100 : 0;
      
      return {
        month: `${month}-01`,
        responses: data.responses,
        nps: Math.round(nps * 10) / 10
      };
    });
    
    return NextResponse.json({
      success: true,
      results: {
        overallTrends,
        monthlyNps,
        monthlyGroups: Object.keys(monthlyGroups),
        errors: {
          overallError,
          monthlyError
        }
      }
    });
    
  } catch (error) {
    console.error('Test trends error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}