import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Check date range of actual data
    const { data: dateRange, error: dateError } = await supabase
      .from('nps_response')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1);
    
    const { data: dateRangeEnd, error: dateEndError } = await supabase
      .from('nps_response')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    
    // Check by year
    const { data: byYear, error: yearError } = await supabase
      .from('nps_response')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    
    const yearCounts: { [key: string]: number } = {};
    byYear?.forEach(row => {
      const year = new Date(row.created_at).getFullYear().toString();
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    
    return NextResponse.json({
      success: true,
      results: {
        earliestDate: dateRange?.[0]?.created_at,
        latestDate: dateRangeEnd?.[0]?.created_at,
        yearCounts,
        sampleDates: byYear?.slice(0, 10).map(r => r.created_at)
      }
    });
    
  } catch (error) {
    console.error('Check dates error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
