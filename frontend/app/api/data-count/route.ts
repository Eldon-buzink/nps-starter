import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Get total count of nps_response records
    const { count: totalResponses, error: totalError } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true });
    
    // Get count of enriched records
    const { count: enrichedCount, error: enrichedError } = await supabase
      .from('nps_ai_enrichment')
      .select('*', { count: 'exact', head: true });
    
    // Get count by year
    const { data: byYear, error: yearError } = await supabase
      .from('nps_response')
      .select('creation_date')
      .order('creation_date', { ascending: false });
    
    const yearCounts: { [key: string]: number } = {};
    byYear?.forEach(row => {
      const year = new Date(row.creation_date).getFullYear().toString();
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    
    // Get sample of creation dates
    const { data: sampleDates, error: sampleError } = await supabase
      .from('nps_response')
      .select('creation_date, title_text, survey_name')
      .order('creation_date', { ascending: false })
      .limit(10);
    
    return NextResponse.json({
      success: true,
      data: {
        totalResponses,
        enrichedCount,
        yearCounts,
        sampleDates: sampleDates?.map(r => ({
          date: r.creation_date,
          title: r.title_text,
          survey: r.survey_name
        }))
      },
      errors: {
        totalError: totalError?.message,
        enrichedError: enrichedError?.message,
        yearError: yearError?.message,
        sampleError: sampleError?.message
      }
    });
    
  } catch (error) {
    console.error('Data count error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
