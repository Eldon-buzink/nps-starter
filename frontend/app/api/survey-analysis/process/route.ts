import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { surveyId } = await request.json();

    if (!surveyId) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
    }

    // Get survey data
    const { data: survey, error: surveyError } = await supabase
      .from('survey_analyses')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Get responses
    const { data: responses, error: responsesError } = await supabase
      .from('survey_responses')
      .select('*')
      .eq('survey_id', surveyId);

    if (responsesError || !responses) {
      return NextResponse.json({ error: 'Responses not found' }, { status: 404 });
    }

    console.log(`Processing ${responses.length} responses for survey ${surveyId}`);

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is missing');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Process responses with AI
    const processedResponses = [];
    const themes = new Map<string, { count: number; responses: any[]; keywords: Set<string> }>();

    for (const response of responses) {
      try {
        console.log(`Processing response ${response.id}: ${response.response_text.substring(0, 50)}...`);
        // Analyze with OpenAI
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Analyze this survey response and extract:
1. Sentiment (positive/negative/neutral)
2. Main themes (2-3 key themes)
3. Keywords (5-10 important words/phrases)
4. NPS score if mentioned (0-10)

Return JSON format:
{
  "sentiment": "positive|negative|neutral",
  "sentiment_score": 0.8,
  "themes": ["theme1", "theme2"],
  "keywords": ["keyword1", "keyword2"],
  "nps_score": 9
}`
            },
            {
              role: "user",
              content: response.response_text
            }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(completion.choices[0].message.content || '{}');
        console.log(`Analysis result for response ${response.id}:`, analysis);
        
        // Update response with analysis (store full blob in ai_analysis)
        const updatedResponse = {
          ...response,
          ai_analysis: analysis,
          sentiment_score: analysis.sentiment_score || 0,
          sentiment_label: analysis.sentiment || 'neutral',
          themes: analysis.themes || []
        };

        processedResponses.push(updatedResponse);

        // Aggregate themes
        if (analysis.themes) {
          for (const theme of analysis.themes) {
            if (!themes.has(theme)) {
              themes.set(theme, { count: 0, responses: [], keywords: new Set() });
            }
            const themeData = themes.get(theme)!;
            themeData.count++;
            themeData.responses.push(response);
            // collect up to a few sample responses per theme later
          }
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing response ${response.id}:`, error);
        // Continue with next response but add to processedResponses with default values
        const defaultResponse = {
          ...response,
          sentiment_score: 0,
          sentiment_label: 'neutral',
          themes: []
        };
        processedResponses.push(defaultResponse);
      }
    }

    // Update responses in database
    console.log(`Updating ${processedResponses.length} responses in database...`);
    for (const response of processedResponses) {
      const { error: updateError } = await supabase
        .from('survey_responses')
        .update({
          ai_analysis: response.ai_analysis
        })
        .eq('id', response.id);
      
      if (updateError) {
        console.error(`Error updating response ${response.id}:`, updateError);
      }
    }

    // Clear previous theme and insight records for idempotent reruns
    await supabase.from('survey_themes').delete().eq('survey_id', surveyId);
    await supabase.from('survey_insights').delete().eq('survey_id', surveyId);

    // Create theme records (with averaged sentiment and sample responses)
    console.log(`Creating ${themes.size} theme records...`);
    for (const [themeName, themeData] of themes) {
      const themeResponses = processedResponses.filter(r => (r.themes || []).includes(themeName));
      const sentimentAvg = themeResponses.length > 0
        ? themeResponses.reduce((sum, r) => sum + (r.sentiment_score || 0), 0) / themeResponses.length
        : 0;
      const samples = themeResponses.slice(0, 3).map(r => r.response_text);
      const { error: themeError } = await supabase
        .from('survey_themes')
        .insert({
          survey_id: surveyId,
          theme_name: themeName,
          mention_count: themeData.count,
          sentiment_score: sentimentAvg,
          sample_responses: samples
        });
      
      if (themeError) {
        console.error(`Error creating theme ${themeName}:`, themeError);
      }
    }

    // Generate insights
    const insights = await generateInsights(processedResponses, themes);
    console.log(`Generated ${insights.length} insights:`, insights);

    // Create insight records
    console.log(`Creating ${insights.length} insight records...`);
    for (const insight of insights) {
      const { error: insightError } = await supabase
        .from('survey_insights')
        .insert({
          survey_id: surveyId,
          insight_type: insight.type === 'problem' ? 'theme' : 
                       insight.type === 'success' ? 'theme' : 
                       insight.type,
          title: insight.title || insight.type,
          description: insight.content,
          priority: Math.round((insight.impact || 0.5) * 10),
          supporting_data: {
            related_themes: insight.themes,
            impact_score: insight.impact
          }
        });
      
      if (insightError) {
        console.error(`Error creating insight:`, insightError);
      }
    }

    // Update survey status
    await supabase
      .from('survey_analyses')
      .update({ 
        status: 'completed',
        total_responses: processedResponses.length
      })
      .eq('id', surveyId);

    return NextResponse.json({ 
      success: true, 
      processed: processedResponses.length,
      themes: themes.size,
      insights: insights.length
    });

  } catch (error) {
    console.error('Error processing survey:', error);
    return NextResponse.json({ error: 'Failed to process survey' }, { status: 500 });
  }
}

async function generateInsights(responses: any[], themes: Map<string, any>) {
  const insights = [];
  
  // Get sentiment breakdown
  const sentimentCounts = responses.reduce((acc, r) => {
    acc[r.sentiment_label] = (acc[r.sentiment_label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalResponses = responses.length;
  const positiveCount = sentimentCounts.positive || 0;
  const negativeCount = sentimentCounts.negative || 0;
  const neutralCount = sentimentCounts.neutral || 0;

  // Adaptive volume weight based on dataset size
  const getVolumeWeight = (mentions: number) => {
    if (totalResponses <= 30) {
      return Math.sqrt(mentions); // Gentle scaling for small datasets
    } else if (totalResponses <= 200) {
      return Math.pow(mentions, 0.75); // Moderate scaling
    } else {
      return mentions; // Full weight for large datasets
    }
  };

  // Calculate theme severity scores (no thresholds - all themes included)
  const themeSeverityScores = new Map();
  for (const [theme, data] of themes.entries()) {
    const volumeWeight = getVolumeWeight(data.count);
    const negativeShare = data.negativeCount / data.count;
    const sentimentDistance = Math.abs(0.5 - (data.avgSentiment || 0.5)); // Distance from neutral
    
    const severityScore = volumeWeight * negativeShare * (1 + sentimentDistance);
    themeSeverityScores.set(theme, {
      ...data,
      severityScore,
      volumeWeight,
      negativeShare,
      sentimentDistance
    });
  }

  // Sort themes by severity score (highest first)
  const sortedThemes = Array.from(themeSeverityScores.entries())
    .sort((a, b) => b[1].severityScore - a[1].severityScore);

  // Insight 1: Customer Satisfaction Overview
  const dominantSentiment = Object.entries(sentimentCounts)
    .sort((a, b) => b[1] - a[1])[0];

  if (dominantSentiment) {
    const satisfactionRate = Math.round((positiveCount / totalResponses) * 100);
    insights.push({
      type: 'summary',
      title: 'Customer Satisfaction Overview',
      content: `${satisfactionRate}% of customers are satisfied (${positiveCount}/${totalResponses} positive responses). ${negativeCount} customers reported issues that need attention.`,
      themes: [],
      impact: 0.8
    });
  }

  // Generate insights for all themes (no thresholds)
  const maxInsights = Math.min(5, sortedThemes.length); // Show top 5 by default
  for (let i = 0; i < maxInsights; i++) {
    const [theme, data] = sortedThemes[i];
    const evidenceCount = Math.min(
      totalResponses <= 30 ? 1 : totalResponses <= 200 ? 2 : 3,
      data.responses.length
    );
    
    const sampleQuotes = data.responses
      .slice(0, evidenceCount)
      .map(r => r.response_text?.substring(0, 150) + '...')
      .filter(Boolean);

    const whyItMatters = data.negativeShare > 0.5 
      ? `High negative share (${Math.round(data.negativeShare * 100)}%) despite ${data.count} mentions.`
      : `Moderate volume (${data.count} mentions) with ${Math.round(data.negativeShare * 100)}% negative sentiment.`;

    insights.push({
      type: 'theme',
      title: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Analysis`,
      content: `**Metrics:** ${data.count} mentions, ${Math.round(data.negativeShare * 100)}% negative, ${Math.round((data.avgSentiment || 0.5) * 100)}% sentiment\n\n**Evidence:**\n${sampleQuotes.map((quote, idx) => `${idx + 1}. "${quote}"`).join('\n')}\n\n**Why it matters:** ${whyItMatters}`,
      themes: [theme],
      impact: Math.min(data.severityScore / 10, 1) // Normalize severity score to 0-1
    });
  }

  // Generate actionable recommendations based on insights
  if (sortedThemes.length > 0) {
    const topThemes = sortedThemes.slice(0, 3);
    let actionPlan = `**Based on ${totalResponses} customer responses, here are specific actions your team should take:**\n\n`;
    
    topThemes.forEach(([theme, data], index) => {
      const positiveCount = data.responses.filter(r => r.sentiment_label === 'positive').length;
      const negativeCount = data.responses.filter(r => r.sentiment_label === 'negative').length;
      
      const positiveFeedback = data.responses
        .filter(r => r.sentiment_label === 'positive')
        .slice(0, 1)
        .map(r => r.response_text?.substring(0, 200))
        .join('');

      const negativeFeedback = data.responses
        .filter(r => r.sentiment_label === 'negative')
        .slice(0, 1)
        .map(r => r.response_text?.substring(0, 200))
        .join('');

      actionPlan += `**${index + 1}. ${theme.charAt(0).toUpperCase() + theme.slice(1)}**\n`;
      actionPlan += `• Mentioned by ${data.count} customers (${positiveCount} positive, ${negativeCount} negative)\n`;
      actionPlan += `• Severity score: ${data.severityScore.toFixed(2)} (${Math.round(data.negativeShare * 100)}% negative)\n`;
      
      if (positiveFeedback) {
        actionPlan += `• Positive feedback: "${positiveFeedback}"\n`;
      }
      
      if (negativeFeedback) {
        actionPlan += `• Issue reported: "${negativeFeedback}"\n`;
      }
      
      if (negativeCount > 0) {
        actionPlan += `• Action: Address the issues mentioned above\n`;
      } else {
        actionPlan += `• Action: Continue current approach - customers are happy\n`;
      }
      
      actionPlan += `\n`;
    });

    insights.push({
      type: 'recommendation',
      title: 'Team Action Plan',
      content: actionPlan,
      themes: topThemes.map(([theme]) => theme),
      impact: 0.9
    });
  }

  return insights;
}
