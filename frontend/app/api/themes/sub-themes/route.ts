import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { theme, responses } = await request.json();

    if (!theme || !responses || responses.length === 0) {
      return NextResponse.json({ error: 'Theme and responses are required' }, { status: 400 });
    }

    // Prepare sample responses for AI analysis
    const sampleResponses = responses.slice(0, 20).map((r: any) => r.nps_explanation).join('\n\n');

    // Create prompt for sub-theme discovery
    const prompt = `Analyze these customer feedback responses about "${theme}" and identify specific sub-themes or patterns in what customers are complaining about or praising.

Responses to analyze:
${sampleResponses}

Please identify 3-5 specific sub-themes within "${theme}" and provide:
1. Sub-theme name (in Dutch)
2. Brief description of what this sub-theme covers
3. Percentage estimate of how common this sub-theme is
4. Sample quote that represents this sub-theme
5. Specific actionable recommendation for this sub-theme

Return as JSON array with this structure:
[
  {
    "subTheme": "sub-theme name in Dutch",
    "description": "brief description",
    "percentage": 25,
    "sampleQuote": "example customer quote",
    "recommendation": "specific actionable recommendation in Dutch"
  }
]`;

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

    // Parse the JSON response
    let subThemes;
    try {
      subThemes = JSON.parse(response);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', response);
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
