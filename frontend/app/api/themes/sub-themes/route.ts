import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  // Initialize OpenAI client inside the handler to avoid build-time errors
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  try {
    const { theme, responses } = await request.json();

    if (!theme || !responses || responses.length === 0) {
      return NextResponse.json({ error: 'Theme and responses are required' }, { status: 400 });
    }

    // Prepare sample responses for AI analysis
    const sampleResponses = responses.slice(0, 20).map((r: any) => r.nps_explanation).join('\n\n');

        // Create theme-specific prompt for more accurate sub-themes
        const getThemeSpecificPrompt = (theme: string, responses: string) => {
          const basePrompt = `Analyze these customer feedback responses about "${theme}" and identify specific sub-themes or patterns. Focus ONLY on aspects that directly relate to "${theme}" - ignore unrelated topics like delivery, pricing, or customer service.

Responses to analyze:
${responses}

Please identify 3-5 specific sub-themes within "${theme}" and provide:
1. Sub-theme name (in Dutch)
2. Brief description of what this sub-theme covers
3. Percentage estimate of how common this sub-theme is
4. Sample quote that represents this sub-theme
5. Specific actionable recommendation for this sub-theme

IMPORTANT: Return ONLY valid JSON array, no markdown formatting or code blocks. Use this exact structure:
[
  {
    "subTheme": "sub-theme name in Dutch",
    "description": "brief description",
    "percentage": 25,
    "sampleQuote": "example customer quote",
    "recommendation": "specific actionable recommendation in Dutch"
  }
]`;

          // Add theme-specific guidance
          if (theme.includes('content') || theme.includes('kwaliteit')) {
            return basePrompt + `

SPECIFIC GUIDANCE FOR CONTENT QUALITY:
- Focus on: article quality, journalism, writing style, topic variety, news coverage, editorial decisions
- IGNORE: delivery issues, pricing complaints, customer service, app functionality
- Look for patterns about: actualiteit (news relevance), diepgang (depth), diversiteit (variety), betrouwbaarheid (reliability)`;
          } else if (theme.includes('delivery') || theme.includes('bezorging')) {
            return basePrompt + `

SPECIFIC GUIDANCE FOR DELIVERY:
- Focus on: timing, packaging, delivery method, location issues
- IGNORE: content quality, pricing, customer service, app issues`;
          } else if (theme.includes('pricing') || theme.includes('prijs')) {
            return basePrompt + `

SPECIFIC GUIDANCE FOR PRICING:
- Focus on: value for money, subscription costs, payment methods, discounts
- IGNORE: content quality, delivery, customer service, app functionality`;
          }
          
          return basePrompt;
        };

        const prompt = getThemeSpecificPrompt(theme, sampleResponses);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in analyzing customer feedback for media companies. Focus on identifying specific, actionable sub-themes that can help editorial teams improve their content. Always respond in Dutch.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response (handle markdown code blocks)
    let subThemes;
    try {
      // Remove markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      subThemes = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', response);
      console.error('Parse error:', parseError);
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Validate the response structure
    if (!Array.isArray(subThemes)) {
      throw new Error('Response is not an array');
    }

    return NextResponse.json({ subThemes });

  } catch (error) {
    console.error('Error in sub-theme discovery:', error);
    return NextResponse.json(
      { error: 'Failed to discover sub-themes' },
      { status: 500 }
    );
  }
}
