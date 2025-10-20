import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    if (!surveyId) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
    }

    // Get survey status
    const { data: survey, error: surveyError } = await supabase
      .from('survey_analyses')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Get processing progress
    const { data: responses, error: responsesError } = await supabase
      .from('survey_responses')
      .select('id, sentiment_score, themes')
      .eq('survey_id', surveyId);

    const { data: themes, error: themesError } = await supabase
      .from('survey_themes')
      .select('*')
      .eq('survey_id', surveyId);

    const { data: insights, error: insightsError } = await supabase
      .from('survey_insights')
      .select('*')
      .eq('survey_id', surveyId);

    const processedCount = responses?.filter(r => r.sentiment_score !== null).length || 0;
    const totalCount = responses?.length || 0;
    const progress = totalCount > 0 ? (processedCount / totalCount) * 100 : 0;

    return NextResponse.json({
      survey: {
        id: survey.id,
        name: survey.name,
        status: survey.status,
        total_responses: survey.total_responses,
        upload_date: survey.created_at
      },
      progress: {
        processed: processedCount,
        total: totalCount,
        percentage: Math.round(progress)
      },
      results: {
        themes: themes?.length || 0,
        insights: insights?.length || 0
      }
    });

  } catch (error) {
    console.error('Error checking status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
