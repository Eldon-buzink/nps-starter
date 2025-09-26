import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Get a sample of the data to see what fields are available
    const { data: sampleData, error } = await supabase
      .from('nps_response')
      .select('*')
      .limit(5);
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
    
    // Check if there are any date fields that might contain the original survey dates
    const firstRow = sampleData?.[0];
    const dateFields = [];
    
    if (firstRow) {
      Object.keys(firstRow).forEach(key => {
        const value = firstRow[key];
        if (value && typeof value === 'string' && value.includes('-') && value.includes('T')) {
          dateFields.push({ field: key, value });
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      results: {
        sampleRow: firstRow,
        allFields: firstRow ? Object.keys(firstRow) : [],
        dateFields,
        totalRows: sampleData?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Check fields error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
