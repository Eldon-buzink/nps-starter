import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log('Testing movers RPC functions...');
    
    // Test 1: Check if top_title_mom_moves RPC exists and works
    const { data: moversData, error: moversError } = await supabase.rpc('top_title_mom_moves', {
      p_start_date: '2024-01-01',
      p_end_date: '2025-12-31',
      p_survey: null,
      p_title: null,
      p_min_responses: 30,
      p_top_k: 5
    });
    
    console.log('Movers RPC result:', { moversData, moversError });
    
    // Test 2: Check monthly NPS by title manually
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('nps_response')
      .select('creation_date, title_text, nps_score')
      .gte('creation_date', '2024-01-01')
      .lte('creation_date', '2025-12-31')
      .not('title_text', 'is', null);
    
    console.log('Monthly data sample:', { 
      count: monthlyData?.length, 
      error: monthlyError 
    });
    
    // Test 3: Group by month and title to find movers
    const monthlyGroups: { [key: string]: { [title: string]: { responses: number, nps_scores: number[] } } } = {};
    
    monthlyData?.forEach(row => {
      const month = new Date(row.creation_date).toISOString().substring(0, 7); // YYYY-MM
      const title = row.title_text;
      
      if (!monthlyGroups[month]) {
        monthlyGroups[month] = {};
      }
      if (!monthlyGroups[month][title]) {
        monthlyGroups[month][title] = { responses: 0, nps_scores: [] };
      }
      monthlyGroups[month][title].responses++;
      monthlyGroups[month][title].nps_scores.push(row.nps_score);
    });
    
    // Calculate NPS for each month/title combination
    const monthlyNps: { [key: string]: { [title: string]: { nps: number, responses: number } } } = {};
    
    Object.entries(monthlyGroups).forEach(([month, titles]) => {
      monthlyNps[month] = {};
      Object.entries(titles).forEach(([title, data]) => {
        if (data.responses >= 30) { // Only titles with 30+ responses
          const promoters = data.nps_scores.filter(score => score >= 9).length;
          const detractors = data.nps_scores.filter(score => score <= 6).length;
          const nps = ((promoters - detractors) / data.responses) * 100;
          
          monthlyNps[month][title] = {
            nps: Math.round(nps * 10) / 10,
            responses: data.responses
          };
        }
      });
    });
    
    // Find biggest movers (comparing last 2 months)
    const months = Object.keys(monthlyNps).sort();
    const movers: Array<{title: string, current_nps: number, previous_nps: number, delta: number, current_responses: number, previous_responses: number}> = [];
    
    if (months.length >= 2) {
      const lastMonth = months[months.length - 1];
      const prevMonth = months[months.length - 2];
      
      Object.keys(monthlyNps[lastMonth] || {}).forEach(title => {
        if (monthlyNps[prevMonth] && monthlyNps[prevMonth][title]) {
          const currentNps = monthlyNps[lastMonth][title].nps;
          const previousNps = monthlyNps[prevMonth][title].nps;
          const delta = currentNps - previousNps;
          
          if (Math.abs(delta) >= 5) { // Significant change
            movers.push({
              title,
              current_nps: currentNps,
              previous_nps: previousNps,
              delta: Math.round(delta * 10) / 10,
              current_responses: monthlyNps[lastMonth][title].responses,
              previous_responses: monthlyNps[prevMonth][title].responses
            });
          }
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      results: {
        moversRpc: moversData,
        moversError,
        monthlyNps: Object.keys(monthlyNps),
        sampleMonthlyData: monthlyNps,
        calculatedMovers: movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5),
        errors: {
          moversError,
          monthlyError
        }
      }
    });
    
  } catch (error) {
    console.error('Test movers error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
