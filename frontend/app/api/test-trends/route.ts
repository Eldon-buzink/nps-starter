import { NextResponse } from 'next/server';
import { getMonthlyTrends, getNpsByTitle } from '@/lib/data';

export async function GET() {
  try {
    const [monthlyTrends, titleData] = await Promise.all([
      getMonthlyTrends(),
      getNpsByTitle()
    ]);
    
    return NextResponse.json({ 
      monthlyTrends, 
      titleData,
      monthlyTrendsCount: monthlyTrends.length,
      titleDataCount: titleData.length
    });
  } catch (error) {
    console.error('Error in test-trends API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
