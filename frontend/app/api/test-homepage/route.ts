import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log('Testing homepage data fetching...');
    
    // Test the exact same call that the homepage makes
    const { data: moversData, error: moversError } = await supabase.rpc('top_title_mom_moves', {
      p_start_date: '2024-01-01',
      p_end_date: '2025-12-31',
      p_survey: null,
      p_title: null,
      p_min_responses: 30,
      p_top_k: 5
    });
    
    console.log('Movers RPC result:', { moversData, moversError });
    
    // Test KPIs
    const { data: kpisData, error: kpisError } = await supabase.rpc('v_nps_summary', {
      p_start: '2024-01-01',
      p_end: '2025-12-31',
      p_survey: null,
      p_title: null
    });
    
    console.log('KPIs RPC result:', { kpisData, kpisError });
    
    // Test themes
    const { data: promoterThemes, error: promoterError } = await supabase.rpc('themes_aggregate', {
      p_start_date: '2024-01-01',
      p_end_date: '2025-12-31',
      p_survey: null,
      p_title: null,
      p_nps_bucket: 'promoter'
    });
    
    const { data: detractorThemes, error: detractorError } = await supabase.rpc('themes_aggregate', {
      p_start_date: '2024-01-01',
      p_end_date: '2025-12-31',
      p_survey: null,
      p_title: null,
      p_nps_bucket: 'detractor'
    });
    
    console.log('Themes RPC results:', { 
      promoterThemes: promoterThemes?.slice(0, 3), 
      detractorThemes: detractorThemes?.slice(0, 3),
      promoterError,
      detractorError
    });
    
    return NextResponse.json({
      success: true,
      results: {
        movers: moversData,
        moversError,
        kpis: kpisData,
        kpisError,
        promoterThemes: promoterThemes?.slice(0, 3),
        detractorThemes: detractorThemes?.slice(0, 3),
        themesErrors: { promoterError, detractorError }
      }
    });
    
  } catch (error) {
    console.error('Test homepage error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
