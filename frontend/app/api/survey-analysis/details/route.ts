import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const surveyId = searchParams.get('surveyId');

  if (!surveyId) {
    return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
  }

  try {
    // Fetch survey metadata
    const { data: surveyData, error: surveyError } = await supabase
      .from('survey_analysis_surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !surveyData) {
      console.error('Error fetching survey metadata:', surveyError);
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Fetch themes for the survey
    const { data: themesData, error: themesError } = await supabase
      .from('survey_analysis_themes')
      .select('*')
      .eq('survey_id', surveyId)
      .order('mention_count', { ascending: false });

    if (themesError) {
      console.error('Error fetching themes:', themesError);
      return NextResponse.json({ error: 'Error fetching themes' }, { status: 500 });
    }

    // Fetch insights for the survey
    const { data: insightsData, error: insightsError } = await supabase
      .from('survey_analysis_insights')
      .select('*')
      .eq('survey_id', surveyId)
      .order('priority', { ascending: false });

    if (insightsError) {
      console.error('Error fetching insights:', insightsError);
      return NextResponse.json({ error: 'Error fetching insights' }, { status: 500 });
    }

    // Fetch sample responses for context
    const { data: responsesData, error: responsesError } = await supabase
      .from('survey_analysis_responses')
      .select('*')
      .eq('survey_id', surveyId)
      .limit(10);

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
      return NextResponse.json({ error: 'Error fetching responses' }, { status: 500 });
    }

    return NextResponse.json({
      survey: surveyData,
      themes: themesData || [],
      insights: insightsData || [],
      sampleResponses: responsesData || []
    });

  } catch (error) {
    console.error('Unexpected error in survey analysis details API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
