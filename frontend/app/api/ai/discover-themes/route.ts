import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { prompt, responses, config } = await req.json();
    
    console.log('AI Theme Discovery: Processing', responses.length, 'responses');
    
    // Call OpenAI for theme discovery
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Je bent een expert in het analyseren van Nederlandse klantfeedback. Geef ALTIJD alleen geldige JSON terug in dit exacte format: [{\"name\": \"thema_naam\", \"confidence\": 0.8, \"explanation\": \"uitleg\", \"businessRelevance\": \"high\"}]. Geen andere tekst."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 800
    });
    
    const responseText = completion.choices[0]?.message?.content || '[]';
    console.log('AI Theme Discovery: Raw response:', responseText);
    
    // Parse JSON response
    let themes;
    try {
      themes = JSON.parse(responseText);
    } catch (parseError) {
      console.error('AI Theme Discovery: JSON parse error:', parseError);
      console.error('Raw response:', responseText);
      
      // Fallback: extract themes from text if JSON parsing fails
      themes = extractThemesFromText(responseText);
    }
    
    // Validate and clean themes
    const validatedThemes = themes
      .filter((theme: any) => theme.name && theme.confidence)
      .map((theme: any) => ({
        name: theme.name.toLowerCase().replace(/\s+/g, '_'),
        confidence: Math.min(1, Math.max(0, theme.confidence || 0.5)),
        explanation: theme.explanation || `AI-discovered theme from customer feedback`,
        businessRelevance: theme.businessRelevance || 'medium'
      }));
    
    console.log('AI Theme Discovery: Validated themes:', validatedThemes.length);
    
    return NextResponse.json({ 
      themes: validatedThemes,
      model: 'gpt-4o-mini',
      processingTime: Date.now()
    });
    
  } catch (error) {
    console.error('AI Theme Discovery Error:', error);
    return NextResponse.json(
      { error: 'Failed to discover themes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Fallback function to extract themes from text when JSON parsing fails
 */
function extractThemesFromText(text: string): Array<{name: string, confidence: number, explanation: string}> {
  const themes = [];
  
  // Look for JSON-like patterns in the text
  try {
    // Try to find JSON arrays in the text
    const jsonMatch = text.match(/\[.*?\]/s);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          name: item.name || 'unknown_theme',
          confidence: item.confidence || 0.7,
          explanation: item.explanation || 'AI-discovered theme'
        }));
      }
    }
  } catch (e) {
    console.log('JSON extraction failed, trying pattern matching');
  }
  
  // Fallback: look for theme patterns in the text
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Look for patterns like "thema_name" or "theme_name"
    const themeMatch = line.match(/"([a-z_]+)"/);
    if (themeMatch && !themes.find(t => t.name === themeMatch[1])) {
      themes.push({
        name: themeMatch[1],
        confidence: 0.7,
        explanation: 'AI-discovered theme (extracted from text)'
      });
    }
  }
  
  return themes;
}
