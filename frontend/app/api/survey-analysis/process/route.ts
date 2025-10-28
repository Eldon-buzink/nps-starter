import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { surveyId } = await request.json();

    if (!surveyId) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
    }

    // Initialize OpenAI client inside the function
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY environment variable is missing');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

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
    console.log('Survey type:', survey.is_multi_question ? 'Multi-question' : 'Single-question');
    console.log('Question columns:', survey.question_columns);

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is missing');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Process responses with AI
    const processedResponses = [];
    const themes = new Map<string, { 
      count: number; 
      responses: any[]; 
      negativeCount: number;
      avgSentiment: number;
      sentimentSum: number;
    }>();

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      try {
        console.log(`Processing response ${i + 1}/${responses.length}: ${response.response_text.substring(0, 50)}...`);
        
        // Update progress in database
        await supabase
          .from('survey_analyses')
          .update({ 
            analysis_results: {
              progress: {
                processed: i,
                total: responses.length,
                percentage: Math.round((i / responses.length) * 100)
              }
            }
          })
          .eq('id', surveyId);
        
        // Analyze with OpenAI
        const systemPrompt = survey.is_multi_question 
          ? `Analyze this survey response and extract:
1. Sentiment: Be decisive - if the response expresses satisfaction, praise, or positive emotions, classify as "positive". If it expresses dissatisfaction, complaints, or negative emotions, classify as "negative". Only use "neutral" for truly neutral statements.
2. Main themes: Extract 2-3 key themes that represent the MAIN TOPICS or ISSUES discussed. Focus on the core subject matter, not descriptive words.
3. Question context: This response is for the question "${response.question_text}". Consider this context when analyzing themes.

Return JSON format:
{
  "sentiment": "positive|negative|neutral",
  "sentiment_score": 0.8,
  "themes": ["theme1", "theme2"],
  "question_context": "${response.question_text}"
}`
          : `Analyze this survey response and extract:
1. Sentiment: Be decisive - if the response expresses satisfaction, praise, or positive emotions, classify as "positive". If it expresses dissatisfaction, complaints, or negative emotions, classify as "negative". Only use "neutral" for truly neutral statements.
2. Main themes: Extract 2-3 key themes that represent the MAIN TOPICS or ISSUES discussed. Focus on the core subject matter, not descriptive words.

Return JSON format:
{
  "sentiment": "positive|negative|neutral",
  "sentiment_score": 0.8,
  "themes": ["theme1", "theme2"]
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: systemPrompt
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
            // Clean theme name more thoroughly
            const cleanThemeName = theme
              .replace(/^(question_\\d+_|response_text_)/, '') // Remove prefixes
              .replace(/_/g, ' ') // Replace underscores with spaces
              .replace(/\b\w/g, (l: string) => l.toUpperCase()) // Capitalize first letter of each word
              .trim();
            
            if (!themes.has(cleanThemeName)) {
              themes.set(cleanThemeName, { 
                count: 0, 
                responses: [], 
                negativeCount: 0,
                avgSentiment: 0,
                sentimentSum: 0
              });
            }
            const themeData = themes.get(cleanThemeName)!;
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
    const insights = await generateInsights(processedResponses, themes, survey);
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

async function generateInsights(responses: any[], themes: Map<string, any>, survey: any) {
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

  // Multi-question analysis: group by question
  if (survey.is_multi_question) {
    const questionGroups = responses.reduce((acc, r) => {
      const question = r.question_text || 'Unknown';
      if (!acc[question]) {
        acc[question] = [];
      }
      acc[question].push(r);
      return acc;
    }, {} as Record<string, any[]>);

    console.log('Question groups:', Object.keys(questionGroups).map(q => `${q}: ${questionGroups[q].length} responses`));

    // Generate per-question insights
    for (const [questionText, questionResponses] of Object.entries(questionGroups)) {
      if ((questionResponses as any[]).length > 0) {
        const questionThemes = new Map();
        
        // Filter themes for this question
        for (const [themeName, themeData] of themes.entries()) {
          const questionThemeResponses = themeData.responses.filter((r: any) =>
            (questionResponses as any[]).some((qr: any) => qr.id === r.id)
          );
          if (questionThemeResponses.length > 0) {
            questionThemes.set(themeName, {
              ...themeData,
              responses: questionThemeResponses,
              count: questionThemeResponses.length
            });
          }
        }

        // Generate insights for this question
        const questionInsights = await generateQuestionInsights(questionText, questionResponses as any[], questionThemes);
        insights.push(...questionInsights);
      }
    }

    // Add overall cross-question insights for multi-question surveys
    const overallInsights = await generateOverallInsights(responses, themes, survey);
    insights.push(...overallInsights);
  }

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
    
    // Balanced scoring: prioritize volume but also consider sentiment impact
    const sentimentImpact = negativeShare > 0.5 ? negativeShare : (1 - negativeShare); // Higher impact for extreme sentiment
    const severityScore = volumeWeight * (0.7 * sentimentImpact + 0.3 * (1 + sentimentDistance));
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
    .sort((a: any, b: any) => b[1] - a[1])[0];

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
  const usedQuotes = new Set(); // Track used quotes to avoid duplicates
  
  for (let i = 0; i < maxInsights; i++) {
    const [theme, data] = sortedThemes[i];
    const evidenceCount = Math.min(
      totalResponses <= 30 ? 1 : totalResponses <= 200 ? 2 : 3,
      data.responses.length
    );
    
    // Get unique quotes that haven't been used yet
    const sampleQuotes = data.responses
      .map((r: any) => r.response_text?.substring(0, 150) + '...')
      .filter(Boolean)
      .filter((quote: any) => !usedQuotes.has(quote))
      .slice(0, evidenceCount);
    
    // Mark quotes as used
    sampleQuotes.forEach((quote: any) => usedQuotes.add(quote));

    const negativeShare = data.negativeCount / data.count;
    const sentimentPercent = Math.round((data.avgSentiment || 0.5) * 100);
    
    const whyItMatters = negativeShare > 0.5 
      ? `High negative share (${Math.round(negativeShare * 100)}%) despite ${data.count} mentions.`
      : `Moderate volume (${data.count} mentions) with ${Math.round(negativeShare * 100)}% negative sentiment.`;

    insights.push({
      type: 'theme',
      title: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Analysis`,
      content: `**Metrics:** ${data.count} mentions, ${Math.round(negativeShare * 100)}% negative, ${sentimentPercent}% sentiment\n\n**Evidence:**\n${sampleQuotes.map((quote: any, idx: number) => `${idx + 1}. "${quote}"`).join('\n')}\n\n**Why it matters:** ${whyItMatters}`,
      themes: [theme],
      impact: Math.min(data.severityScore / 10, 1) // Normalize severity score to 0-1
    });
  }

  // Generate actionable recommendations based on insights
  if (sortedThemes.length > 0) {
    const topThemes = sortedThemes.slice(0, 3);
    let actionPlan = `**Based on ${totalResponses} customer responses, here are specific actions your team should take:**\n\n`;
    
    topThemes.forEach(([theme, data], index) => {
      const positiveCount = data.responses.filter((r: any) => r.sentiment_label === 'positive').length;
      const negativeCount = data.responses.filter((r: any) => r.sentiment_label === 'negative').length;
      
      const positiveFeedback = data.responses
        .filter((r: any) => r.sentiment_label === 'positive')
        .slice(0, 1)
        .map((r: any) => r.response_text?.substring(0, 200))
        .join('');

      const negativeFeedback = data.responses
        .filter((r: any) => r.sentiment_label === 'negative')
        .slice(0, 1)
        .map((r: any) => r.response_text?.substring(0, 200))
        .join('');

      actionPlan += `**${index + 1}. ${theme.charAt(0).toUpperCase() + theme.slice(1)}**\n`;
      actionPlan += `• Mentioned by ${data.count} customers (${positiveCount} positive, ${negativeCount} negative)\n`;
      actionPlan += `• Severity score: ${data.severityScore.toFixed(2)} (${Math.round(data.negativeShare * 100)}% negative)\n`;
      
      // Show both positive and negative feedback together with more examples
      if (positiveFeedback && negativeFeedback) {
        actionPlan += `• What customers love: "${positiveFeedback}"\n`;
        actionPlan += `• Issues to address: "${negativeFeedback}"\n`;
      } else if (positiveFeedback) {
        actionPlan += `• What customers love: "${positiveFeedback}"\n`;
        // Show additional positive examples if available
        const additionalPositive = data.responses
          .filter((r: any) => r.sentiment_label === 'positive')
          .slice(1, 2)
          .map((r: any) => r.response_text?.substring(0, 150) + '...')
          .filter(Boolean);
        if (additionalPositive.length > 0) {
          actionPlan += `• Additional positive feedback: "${additionalPositive[0]}"\n`;
        }
      } else if (negativeFeedback) {
        actionPlan += `• Issues to address: "${negativeFeedback}"\n`;
        // Show additional negative examples if available
        const additionalNegative = data.responses
          .filter((r: any) => r.sentiment_label === 'negative')
          .slice(1, 2)
          .map((r: any) => r.response_text?.substring(0, 150) + '...')
          .filter(Boolean);
        if (additionalNegative.length > 0) {
          actionPlan += `• Additional issues: "${additionalNegative[0]}"\n`;
        }
      }
      
      // Generate specific action recommendations based on theme and feedback content
      let action = '';
      if (negativeCount > 0 && positiveCount > 0) {
        // Mixed feedback - be specific about what to maintain and what to fix
        if (positiveFeedback && negativeFeedback) {
          action = `Maintain: ${positiveFeedback.substring(0, 50)}... | Fix: ${negativeFeedback.substring(0, 50)}...`;
        } else {
          action = `Address the issues while maintaining the positive aspects customers love`;
        }
      } else if (negativeCount > 0) {
        // Theme-specific negative actions with better matching
        const themeLower = theme.toLowerCase();
        if (themeLower.includes('shipping') || themeLower.includes('delivery') || themeLower.includes('shipping cost') || themeLower.includes('delivery pricing')) {
          action = `Review shipping costs and delivery options - consider free shipping thresholds or alternative carriers`;
        } else if (themeLower.includes('pricing') || themeLower.includes('cost') || themeLower.includes('price')) {
          action = `Analyze pricing strategy and competitor positioning - consider value-based pricing or discounts`;
        } else if (themeLower.includes('quality') || themeLower.includes('product') || themeLower.includes('product quality')) {
          action = `Investigate quality control processes and customer expectations - review manufacturing standards`;
        } else if (themeLower.includes('support') || themeLower.includes('service') || themeLower.includes('customer service') || themeLower.includes('support quality')) {
          action = `Enhance customer service training and response times - consider additional support channels`;
        } else if (themeLower.includes('interface') || themeLower.includes('usability') || themeLower.includes('user interface') || themeLower.includes('navigation')) {
          action = `Conduct UX research and usability testing - prioritize user experience improvements`;
        } else {
          action = `Investigate root cause and implement targeted improvements`;
        }
      } else if (positiveCount > 0) {
        action = `Continue and amplify what customers love - consider featuring this in marketing and product development`;
      } else {
        action = `Monitor this theme for future feedback and trends`;
      }
      
      actionPlan += `• Action: ${action}\n`;
      
      // Add business impact explanation
      if (data.count >= 3) {
        actionPlan += `• Why this matters: ${data.count} customers mentioned this - significant impact on customer satisfaction\n`;
      } else if (data.count >= 2) {
        actionPlan += `• Why this matters: Multiple customers mentioned this - worth investigating\n`;
      } else {
        actionPlan += `• Why this matters: Early signal - monitor for trends\n`;
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

// Generate insights for a specific question
async function generateQuestionInsights(questionText: string, questionResponses: any[], questionThemes: Map<string, any>) {
  const insights = [];
  
  // Question-specific sentiment breakdown
  const sentimentCounts = questionResponses.reduce((acc, r) => {
    acc[r.sentiment_label] = (acc[r.sentiment_label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalResponses = questionResponses.length;
  const positiveCount = sentimentCounts.positive || 0;
  const negativeCount = sentimentCounts.negative || 0;

  // Question summary insight
  insights.push({
    type: 'summary',
    title: `Question Analysis: ${questionText}`,
    content: `**Question:** ${questionText}\n\n**Response Summary:** ${totalResponses} responses (${positiveCount} positive, ${negativeCount} negative)\n\n**Key Themes:** ${Array.from(questionThemes.keys()).slice(0, 3).join(', ')}`,
    themes: Array.from(questionThemes.keys()),
    impact: 0.7
  });

  // Top themes for this question
  const sortedThemes = Array.from(questionThemes.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);

  for (const [themeName, themeData] of sortedThemes) {
    const positiveResponses = themeData.responses.filter((r: any) => r.sentiment_label === 'positive');
    const negativeResponses = themeData.responses.filter((r: any) => r.sentiment_label === 'negative');
    
    const positiveFeedback = positiveResponses
      .slice(0, 1)
      .map((r: any) => r.response_text?.substring(0, 150) + '...')
      .join('');

    const negativeFeedback = negativeResponses
      .slice(0, 1)
      .map((r: any) => r.response_text?.substring(0, 150) + '...')
      .join('');

    insights.push({
      type: 'theme',
      title: `${themeName} (${questionText})`,
      content: `**Question:** ${questionText}\n\n**Theme:** ${themeName}\n**Mentions:** ${themeData.count}\n\n${positiveFeedback ? `**Positive feedback:** "${positiveFeedback}"\n\n` : ''}${negativeFeedback ? `**Issues to address:** "${negativeFeedback}"\n\n` : ''}**Why this matters:** This theme appeared ${themeData.count} times in responses to "${questionText}".`,
      themes: [themeName],
      impact: 0.6
    });
  }

  return insights;
}

// Generate overall insights for multi-question surveys
async function generateOverallInsights(responses: any[], themes: Map<string, any>, survey: any) {
  const insights = [];
  
  // Overall sentiment summary
  const sentimentCounts = responses.reduce((acc, r) => {
    acc[r.sentiment_label] = (acc[r.sentiment_label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalResponses = responses.length;
  const positiveCount = sentimentCounts.positive || 0;
  const negativeCount = sentimentCounts.negative || 0;

  insights.push({
    type: 'summary',
    title: 'Overall Survey Analysis',
    content: `**Multi-Question Survey Analysis**\n\n**Total Responses:** ${totalResponses} across ${survey.question_columns?.length || 0} questions\n**Sentiment:** ${positiveCount} positive, ${negativeCount} negative\n\n**Cross-Question Themes:** ${Array.from(themes.keys()).slice(0, 5).join(', ')}`,
    themes: Array.from(themes.keys()),
    impact: 0.8
  });

  return insights;
}
