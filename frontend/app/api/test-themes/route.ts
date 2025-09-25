import { NextResponse } from 'next/server';
import { getThemesAggregate } from '@/lib/themes-data';

export async function GET() {
  try {
    const themes = await getThemesAggregate();
    return NextResponse.json({ themes, count: themes.length });
  } catch (error) {
    console.error('Error in test-themes API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
