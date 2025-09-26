import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log('Testing RPC functions...');
    
    // Test 1: Check if we can connect to Supabase
    const { data: testData, error: testError } = await supabase
      .from('nps_response')
      .select('count')
      .limit(1);
    
    console.log('Basic connection test:', { testData, testError });
    
    // Test 2: Check total responses
    const { count: totalResponses, error: countError } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true });
    
    console.log('Total responses:', { totalResponses, countError });
    
    // Test 3: Check responses in 2024
    const { count: responses2024, error: count2024Error } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', '2024-01-01')
      .lte('created_at', '2024-12-31');
    
    console.log('Responses in 2024:', { responses2024, count2024Error });
    
    // Test 4: Try the v_nps_summary RPC
    const { data: summaryData, error: summaryError } = await supabase.rpc('v_nps_summary', {
      p_start: '2024-01-01',
      p_end: '2024-12-31',
      p_survey: null,
      p_title: null
    });
    
    console.log('v_nps_summary RPC result:', { summaryData, summaryError });
    
    // Test 5: Check AI enrichment data
    const { count: enrichmentCount, error: enrichmentError } = await supabase
      .from('nps_ai_enrichment')
      .select('*', { count: 'exact', head: true });
    
    console.log('AI enrichment count:', { enrichmentCount, enrichmentError });
    
    return NextResponse.json({
      success: true,
      results: {
        totalResponses,
        responses2024,
        summaryData,
        enrichmentCount,
        errors: {
          countError,
          count2024Error,
          summaryError,
          enrichmentError
        }
      }
    });
    
  } catch (error) {
    console.error('Debug RPC error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
