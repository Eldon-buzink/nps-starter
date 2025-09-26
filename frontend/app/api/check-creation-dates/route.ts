import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Check the actual date range of creation_date field
    const { data: dateRange, error: dateError } = await supabase
      .from('nps_response')
      .select('creation_date')
      .order('creation_date', { ascending: true })
      .limit(1);
    
    const { data: dateRangeEnd, error: dateEndError } = await supabase
      .from('nps_response')
      .select('creation_date')
      .order('creation_date', { ascending: false })
      .limit(1);
    
    // Check by year using creation_date
    const { data: byYear, error: yearError } = await supabase
      .from('nps_response')
      .select('creation_date')
      .order('creation_date', { ascending: false })
      .limit(100);
    
    const yearCounts: { [key: string]: number } = {};
    byYear?.forEach(row => {
      const year = new Date(row.creation_date).getFullYear().toString();
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    
    // Check by month using creation_date
    const { data: byMonth, error: monthError } = await supabase
      .from('nps_response')
      .select('creation_date')
      .order('creation_date', { ascending: false })
      .limit(1000);
    
    const monthCounts: { [key: string]: number } = {};
    byMonth?.forEach(row => {
      const month = new Date(row.creation_date).toISOString().substring(0, 7); // YYYY-MM
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    
    return NextResponse.json({
      success: true,
      results: {
        earliestCreationDate: dateRange?.[0]?.creation_date,
        latestCreationDate: dateRangeEnd?.[0]?.creation_date,
        yearCounts,
        monthCounts,
        sampleCreationDates: byYear?.slice(0, 10).map(r => r.creation_date)
      }
    });
    
  } catch (error) {
    console.error('Check creation dates error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
