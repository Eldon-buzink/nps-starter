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
    const themes = new Map<string, { count: number; responses: any[] }>();

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
1. Sentiment: Be decisive - if the response expresses satisfaction, praise, or positive emotions, classify as "positive". If it expresses dissatisfaction, complaints, or negative emotions, classify as "negative". Only use "neutral" for truly neutral statements.
2. Main themes: Extract 2-3 key themes that represent the MAIN TOPICS or ISSUES discussed. Focus on the core subject matter, not descriptive words. For example:
   - If someone says "shipping was too expensive for a small item" → theme should be "shipping cost" or "delivery pricing", not "small item"
   - If someone says "love the new interface" → theme should be "user interface" or "usability", not "new"
   - If someone says "customer support was amazing" → theme should be "customer service" or "support quality"

Return JSON format:
{
  "sentiment": "positive|negative|neutral",
  "sentiment_score": 0.8,
  "themes": ["theme1", "theme2"]
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
        
        // Validate analysis structure
        if (!analysis.sentiment || !analysis.sentiment_score || !analysis.themes) {
          console.error(`Invalid analysis structure for response ${response.id}:`, analysis);
          throw new Error('Invalid AI analysis structure');
        }
        
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
              themes.set(theme, { 
                count: 0, 
                responses: [], 
                negativeCount: 0,
                avgSentiment: 0,
                sentimentSum: 0
              });
            }
            const themeData = themes.get(theme)!;
            themeData.count++;
            themeData.responses.push(updatedResponse);
            
            // Track negative sentiment
            if (updatedResponse.sentiment_label === 'negative') {
              themeData.negativeCount++;
            }
            
            // Track sentiment for averaging
            themeData.sentimentSum += updatedResponse.sentiment_score;
            themeData.avgSentiment = themeData.sentimentSum / themeData.count;
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
    const { error: statusError } = await supabase
      .from('survey_analyses')
      .update({ 
        status: 'completed',
        total_responses: processedResponses.length
      })
      .eq('id', surveyId);
    
    if (statusError) {
      console.error('Error updating survey status:', statusError);
      throw new Error('Failed to update survey status');
    }
    
    console.log(`Survey ${surveyId} processing completed successfully`);

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

  // Insight 2: What Customers Love (if there are positive responses)
  if (positiveCount > 0) {
    const positiveThemes = Array.from(themeSeverityScores.entries())
      .filter(([_, data]) => data.responses.some(r => r.sentiment_label === 'positive'))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3);

    if (positiveThemes.length > 0) {
      const topPositiveTheme = positiveThemes[0];
      const positiveQuotes = topPositiveTheme[1].responses
        .filter(r => r.sentiment_label === 'positive')
        .slice(0, 2)
        .map(r => r.response_text?.substring(0, 150) + '...')
        .filter(Boolean);

      insights.push({
        type: 'summary',
        title: 'What Customers Love',
        content: `**Top Positive Theme:** ${topPositiveTheme[0]} (${topPositiveTheme[1].count} mentions)\n\n**Customer Feedback:**\n${positiveQuotes.map((quote, idx) => `${idx + 1}. "${quote}"`).join('\n')}\n\n**Why it matters:** This is what customers appreciate most about your product/service. Consider highlighting these strengths in marketing and ensuring they remain consistent.`,
        themes: [topPositiveTheme[0]],
        impact: 0.7
      });
    }
  }

  // Generate insights for all themes (no thresholds)
  const maxInsights = Math.min(5, sortedThemes.length); // Show top 5 by default
  const usedQuotes = new Set(); // Track used quotes to avoid duplicates
  
  for (let i = 0; i < maxInsights; i++) {
    const [theme, data] = sortedThemes[i];
    const evidenceCount = Math.min(
      totalResponses <= 30 ? 1 : totalResponses <= 200 ? 2 : 3,
      data.responses.length
    );
    
    // Get unique quotes that haven't been used yet
    const sampleQuotes = data.responses
      .map(r => r.response_text?.substring(0, 150) + '...')
      .filter(Boolean)
      .filter(quote => !usedQuotes.has(quote))
      .slice(0, evidenceCount);
    
    // Mark quotes as used
    sampleQuotes.forEach(quote => usedQuotes.add(quote));

    const negativeShare = data.negativeCount / data.count;
    const sentimentPercent = Math.round((data.avgSentiment || 0.5) * 100);
    
    const whyItMatters = negativeShare > 0.5 
      ? `High negative share (${Math.round(negativeShare * 100)}%) despite ${data.count} mentions.`
      : `Moderate volume (${data.count} mentions) with ${Math.round(negativeShare * 100)}% negative sentiment.`;

    insights.push({
      type: 'theme',
      title: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Analysis`,
      content: `**Metrics:** ${data.count} mentions, ${Math.round(negativeShare * 100)}% negative, ${sentimentPercent}% sentiment\n\n**Evidence:**\n${sampleQuotes.map((quote, idx) => `${idx + 1}. "${quote}"`).join('\n')}\n\n**Why it matters:** ${whyItMatters}`,
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
      
      if (negativeCount > 0 && positiveCount > 0) {
        actionPlan += `• Action: Address the issues while maintaining the positive aspects customers love\n`;
      } else if (negativeCount > 0) {
        actionPlan += `• Action: Address the issues mentioned above\n`;
      } else if (positiveCount > 0) {
        actionPlan += `• Action: Continue and amplify what customers love - consider featuring this in marketing\n`;
      } else {
        actionPlan += `• Action: Monitor this theme for future feedback\n`;
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
