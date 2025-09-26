import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log('Testing themes RPC functions...');
    
    // Test 1: Check themes_aggregate for promoters
    const { data: promoterThemes, error: promoterError } = await supabase.rpc('themes_aggregate', {
      p_start_date: '2025-01-01',
      p_end_date: '2025-12-31',
      p_survey: null,
      p_title: null,
      p_nps_bucket: 'promoter'
    });
    
    console.log('Promoter themes RPC result:', { promoterThemes, promoterError });
    
    // Test 2: Check themes_aggregate for detractors
    const { data: detractorThemes, error: detractorError } = await supabase.rpc('themes_aggregate', {
      p_start_date: '2025-01-01',
      p_end_date: '2025-12-31',
      p_survey: null,
      p_title: null,
      p_nps_bucket: 'detractor'
    });
    
    console.log('Detractor themes RPC result:', { detractorThemes, detractorError });
    
    // Test 3: Check if we have any themes in the AI enrichment table
    const { data: themesData, error: themesError } = await supabase
      .from('nps_ai_enrichment')
      .select('themes')
      .not('themes', 'is', null)
      .limit(5);
    
    console.log('Sample themes from AI enrichment:', { themesData, themesError });
    
    // Test 4: Check the v_nps_response_themes view
    const { data: viewData, error: viewError } = await supabase
      .from('v_nps_response_themes')
      .select('*')
      .limit(5);
    
    console.log('v_nps_response_themes view sample:', { viewData, viewError });
    
    return NextResponse.json({
      success: true,
      results: {
        promoterThemes: promoterThemes?.slice(0, 3) || [],
        detractorThemes: detractorThemes?.slice(0, 3) || [],
        sampleThemes: themesData,
        viewSample: viewData,
        errors: {
          promoterError,
          detractorError,
          themesError,
          viewError
        }
      }
    });
    
  } catch (error) {
    console.error('Test themes error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}