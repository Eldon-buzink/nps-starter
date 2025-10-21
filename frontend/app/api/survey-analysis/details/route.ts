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
      .from('survey_analyses')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !surveyData) {
      console.error('Error fetching survey metadata:', surveyError);
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Fetch themes for the survey
    const { data: themesData, error: themesError } = await supabase
      .from('survey_themes')
      .select('*')
      .eq('survey_id', surveyId)
      .order('mention_count', { ascending: false });

    if (themesError) {
      console.error('Error fetching themes:', themesError);
      return NextResponse.json({ error: 'Error fetching themes' }, { status: 500 });
    }

    // Fetch insights for the survey
    const { data: insightsData, error: insightsError } = await supabase
      .from('survey_insights')
      .select('*')
      .eq('survey_id', surveyId)
      .order('priority', { ascending: false });

    if (insightsError) {
      console.error('Error fetching insights:', insightsError);
      return NextResponse.json({ error: 'Error fetching insights' }, { status: 500 });
    }

    // Fetch sample responses for context
    const { data: responsesData, error: responsesError } = await supabase
      .from('survey_responses')
      .select('*')
      .eq('survey_id', surveyId)
      .limit(10);

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
      return NextResponse.json({ error: 'Error fetching responses' }, { status: 500 });
    }

    // Map the data to match the frontend expectations
    const mappedSurvey = {
      id: surveyData.id,
      survey_name: surveyData.name,
      total_responses: surveyData.total_responses,
      upload_date: surveyData.created_at,
      status: surveyData.status,
      is_multi_question: surveyData.is_multi_question || false,
      question_columns: surveyData.question_columns || [],
      headers: surveyData.headers || []
    };

    // Deduplicate themes with the same name (in case the survey was reprocessed)
    const themeAccumulator = new Map<string, { id: string; theme_name: string; mention_count: number; sentiment_sum: number; sentiment_samples: number; sample_responses: string[] }>();
    (themesData || []).forEach((t: any) => {
      const key = String(t.theme_name).trim().toLowerCase();
      if (!themeAccumulator.has(key)) {
        themeAccumulator.set(key, {
          id: t.id,
          theme_name: t.theme_name,
          mention_count: t.mention_count || 0,
          sentiment_sum: Number(t.sentiment_score || 0) * (t.mention_count || 1),
          sentiment_samples: (t.mention_count || 1),
          sample_responses: Array.isArray(t.sample_responses) ? t.sample_responses.slice(0, 5) : []
        });
      } else {
        const acc = themeAccumulator.get(key)!;
        acc.mention_count += t.mention_count || 0;
        acc.sentiment_sum += Number(t.sentiment_score || 0) * (t.mention_count || 1);
        acc.sentiment_samples += (t.mention_count || 1);
        if (Array.isArray(t.sample_responses)) {
          acc.sample_responses = Array.from(new Set([...acc.sample_responses, ...t.sample_responses])).slice(0, 5);
        }
      }
    });

    const mappedThemes = Array.from(themeAccumulator.values())
      .map(t => ({
        id: t.id,
        theme_name: t.theme_name,
        mention_count: t.mention_count,
        sentiment_score: t.sentiment_samples > 0 ? (t.sentiment_sum / t.sentiment_samples) : 0,
        sample_responses: t.sample_responses
      }))
      .sort((a, b) => (b.mention_count - a.mention_count));

    const mappedInsights = (insightsData || []).map(insight => ({
      id: insight.id,
      insight_type: insight.insight_type,
      title: insight.title,
      description: insight.description,
      priority: insight.priority,
      supporting_data: insight.supporting_data
    }));

    const mappedResponses = (responsesData || []).map(response => {
      const aiAnalysis = response.ai_analysis || {};
      
      return {
        id: response.id,
        response_text: response.response_text,
        sentiment_score: aiAnalysis.sentiment_score || 0.5,
        sentiment_label: aiAnalysis.sentiment || 'neutral',
        themes: aiAnalysis.themes || [],
        question_text: response.question_text || null
      };
    });

    return NextResponse.json({
      survey: mappedSurvey,
      themes: mappedThemes,
      insights: mappedInsights,
      sampleResponses: mappedResponses
    });

  } catch (error) {
    console.error('Unexpected error in survey analysis details API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
