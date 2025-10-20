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
          themes: analysis.themes || [],
          nps_score: analysis.nps_score || null
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
          themes: [],
          keywords: [],
          nps_score: null
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
          ai_analysis: response.ai_analysis,
          sentiment_score: response.sentiment_score,
          sentiment_label: response.sentiment_label,
          themes: response.themes,
          nps_score: response.nps_score
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
          insight_type: insight.type,
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

  // Insight 2: Critical Issues Requiring Immediate Attention
  const negativeResponses = responses.filter(r => r.sentiment_label === 'negative');
  if (negativeResponses.length > 0) {
    const negativeThemes = new Map();
    negativeResponses.forEach(r => {
      r.themes?.forEach((theme: string) => {
        negativeThemes.set(theme, (negativeThemes.get(theme) || 0) + 1);
      });
    });

    const topNegativeTheme = Array.from(negativeThemes.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (topNegativeTheme) {
      const sampleNegative = negativeResponses.find(r => 
        (r.themes || []).includes(topNegativeTheme[0])
      )?.response_text;

      insights.push({
        type: 'problem',
        title: 'Critical Issue Identified',
        content: `${topNegativeTheme[1]} customers reported problems with ${topNegativeTheme[0]}. Sample feedback: "${sampleNegative}"`,
        themes: [topNegativeTheme[0]],
        impact: 0.9
      });
    }
  }

  // Insight 3: What's Working Well (Positive Themes)
  const positiveResponses = responses.filter(r => r.sentiment_label === 'positive');
  if (positiveResponses.length > 0) {
    const positiveThemes = new Map();
    positiveResponses.forEach(r => {
      r.themes?.forEach((theme: string) => {
        positiveThemes.set(theme, (positiveThemes.get(theme) || 0) + 1);
      });
    });

    const topPositiveTheme = Array.from(positiveThemes.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (topPositiveTheme) {
      const samplePositive = positiveResponses.find(r => 
        (r.themes || []).includes(topPositiveTheme[0])
      )?.response_text;

      insights.push({
        type: 'success',
        title: 'What Customers Love',
        content: `${topPositiveTheme[1]} customers praised ${topPositiveTheme[0]}. Sample feedback: "${samplePositive}"`,
        themes: [topPositiveTheme[0]],
        impact: 0.7
      });
    }
  }

  // Insight 4: Specific Actionable Recommendations
  const topThemes = Array.from(themes.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);

  if (topThemes.length > 0) {
    const recThemes = topThemes.map(([name]) => name);
    
    // Get specific evidence for each theme
    const evidenceMap = new Map();
    recThemes.forEach(theme => {
      const themeResponses = responses.filter(r => (r.themes || []).includes(theme));
      const positive = themeResponses.filter(r => r.sentiment_label === 'positive');
      const negative = themeResponses.filter(r => r.sentiment_label === 'negative');
      
      evidenceMap.set(theme, {
        total: themeResponses.length,
        positive: positive.length,
        negative: negative.length,
        samplePositive: positive[0]?.response_text,
        sampleNegative: negative[0]?.response_text
      });
    });

    let recommendationContent = `**Based on ${totalResponses} customer responses, here are specific actions your team should take:**\n\n`;
    
    recThemes.forEach((theme, index) => {
      const evidence = evidenceMap.get(theme);
      if (evidence) {
        recommendationContent += `**${index + 1}. ${theme.charAt(0).toUpperCase() + theme.slice(1)}**\n`;
        recommendationContent += `• Mentioned by ${evidence.total} customers (${evidence.positive} positive, ${evidence.negative} negative)\n`;
        
        if (evidence.samplePositive) {
          recommendationContent += `• Positive feedback: "${evidence.samplePositive}"\n`;
        }
        if (evidence.sampleNegative) {
          recommendationContent += `• Issue reported: "${evidence.sampleNegative}"\n`;
        }
        recommendationContent += `• Action: ${evidence.negative > 0 ? 'Address the issues mentioned above' : 'Continue current approach - customers are happy'}\n\n`;
      }
    });

    insights.push({
      type: 'recommendation',
      title: 'Team Action Plan',
      content: recommendationContent,
      themes: recThemes,
      impact: 0.9
    });
  }

  return insights;
}
