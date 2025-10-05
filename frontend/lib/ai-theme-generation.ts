/**
 * AI Theme Generation System - Hybrid Approach
 * 
 * This system combines predefined business themes with AI-discovered themes
 * from actual customer feedback data.
 */

export interface ThemeGenerationConfig {
  // Base themes (predefined business categories)
  baseThemes: string[];
  
  // AI generation parameters
  maxThemesPerResponse: number;
  minThemeFrequency: number; // Minimum % of responses that must mention a theme
  maxTotalThemes: number;
  language: string;
  
  // Business focus areas for AI guidance
  focusAreas: string[];
}

export interface GeneratedTheme {
  name: string;
  source: 'base' | 'ai_discovered';
  frequency: number; // % of responses mentioning this theme
  confidence: number; // AI confidence score (0-1)
  explanation: string; // Why this theme was generated
  businessRelevance: 'high' | 'medium' | 'low';
}

export interface ThemeGenerationResult {
  themes: GeneratedTheme[];
  totalResponses: number;
  processingTime: number;
  aiModel: string;
}

// Default configuration for newspaper/media industry
export const DEFAULT_CONFIG: ThemeGenerationConfig = {
  baseThemes: [
    'content_kwaliteit',
    'pricing', 
    'merkvertrouwen',
    'overige'
  ],
  maxThemesPerResponse: 3,
  minThemeFrequency: 0.05, // 5% of responses
  maxTotalThemes: 8,
  language: 'dutch',
  focusAreas: [
    'content_quality',
    'pricing',
    'customer_service', 
    'user_experience',
    'brand_trust',
    'delivery',
    'technical_issues',
    'subscription',
    'mobile_app',
    'website_usage'
  ]
};

/**
 * Generate themes using hybrid approach
 */
export async function generateThemes(
  responses: Array<{id: string, comment: string, nps_score: number}>,
  config: ThemeGenerationConfig = DEFAULT_CONFIG
): Promise<ThemeGenerationResult> {
  const startTime = Date.now();
  
  // Step 1: Analyze responses for AI theme discovery
  const aiThemes = await discoverAIThemes(responses, config);
  
  // Step 2: Combine with base themes
  const allThemes = combineThemes(config.baseThemes, aiThemes, config);
  
  // Step 3: Calculate frequencies and confidence scores
  const enrichedThemes = await enrichThemes(allThemes, responses, config);
  
  // Step 4: Filter and rank themes
  const finalThemes = filterAndRankThemes(enrichedThemes, config);
  
  return {
    themes: finalThemes,
    totalResponses: responses.length,
    processingTime: Date.now() - startTime,
    aiModel: 'gpt-4o-mini'
  };
}

/**
 * Use AI to discover new themes from customer feedback
 */
async function discoverAIThemes(
  responses: Array<{id: string, comment: string, nps_score: number}>,
  config: ThemeGenerationConfig
): Promise<Array<{name: string, confidence: number, explanation: string}>> {
  
  // Sample responses for AI analysis (to avoid token limits)
  const sampleSize = Math.min(100, responses.length);
  const sampleResponses = responses
    .filter(r => r.comment && r.comment.trim().length > 10)
    .slice(0, sampleSize);
  
  if (sampleResponses.length === 0) {
    return [];
  }
  
  const prompt = createThemeDiscoveryPrompt(sampleResponses, config);
  
  try {
    // Call OpenAI API for theme discovery
    const response = await fetch('/api/ai/discover-themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt,
        responses: sampleResponses,
        config 
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI theme discovery failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.themes || [];
    
  } catch (error) {
    console.error('AI theme discovery error:', error);
    return [];
  }
}

/**
 * Create prompt for AI theme discovery
 */
function createThemeDiscoveryPrompt(
  responses: Array<{id: string, comment: string, nps_score: number}>,
  config: ThemeGenerationConfig
): string {
  const responseTexts = responses.map(r => r.comment).join('\n\n');
  
  return `
Je bent een expert in het analyseren van Nederlandse klantfeedback voor een mediabedrijf (kranten/nieuws).

Analyseer de volgende klantfeedback en ontdek 3-5 nieuwe thema's die NIET in de bestaande categorieën zitten:
Bestaande categorieën: ${config.baseThemes.join(', ')}

Focus op:
- Business-relevante thema's (dingen die het bedrijf kan verbeteren)
- Specifieke thema's (niet te breed zoals "service")
- Actiegerichte thema's (wat klanten echt belangrijk vinden)

Feedback voor analyse:
${responseTexts}

Geef voor elk nieuw thema:
1. Thema naam (1-3 woorden, in het Nederlands, snake_case)
2. Vertrouwen (0-1)
3. Uitleg waarom dit thema belangrijk is
4. Business relevantie (high/medium/low)

Format: JSON array met objecten {name, confidence, explanation, businessRelevance}

Voorbeelden van goede thema's:
- "abonnement_beheer" (klanten hebben problemen met abonnementen)
- "mobiele_app" (klachten over de mobiele app)
- "nieuws_actualiteit" (feedback over nieuwswaarde)
- "klantenservice" (ervaringen met klantenservice)

Geef alleen JSON terug, geen andere tekst.
`;
}

/**
 * Combine base themes with AI-discovered themes
 */
function combineThemes(
  baseThemes: string[],
  aiThemes: Array<{name: string, confidence: number, explanation: string}>,
  config: ThemeGenerationConfig
): Array<{name: string, source: 'base' | 'ai_discovered', confidence: number, explanation: string}> {
  
  const combined = [];
  
  // Add base themes
  for (const theme of baseThemes) {
    combined.push({
      name: theme,
      source: 'base' as const,
      confidence: 1.0,
      explanation: 'Predefined business category'
    });
  }
  
  // Add AI-discovered themes
  for (const theme of aiThemes) {
    combined.push({
      name: theme.name,
      source: 'ai_discovered' as const,
      confidence: theme.confidence,
      explanation: theme.explanation
    });
  }
  
  return combined;
}

/**
 * Enrich themes with frequency data and business relevance
 */
async function enrichThemes(
  themes: Array<{name: string, source: 'base' | 'ai_discovered', confidence: number, explanation: string}>,
  responses: Array<{id: string, comment: string, nps_score: number}>,
  config: ThemeGenerationConfig
): Promise<GeneratedTheme[]> {
  
  const enriched = [];
  
  for (const theme of themes) {
    // Calculate frequency (simplified - in real implementation, use AI classification)
    const frequency = await calculateThemeFrequency(theme.name, responses);
    
    // Determine business relevance
    const businessRelevance = determineBusinessRelevance(theme.name, theme.source);
    
    enriched.push({
      name: theme.name,
      source: theme.source,
      frequency,
      confidence: theme.confidence,
      explanation: theme.explanation,
      businessRelevance
    });
  }
  
  return enriched;
}

/**
 * Calculate how often a theme appears in responses
 */
async function calculateThemeFrequency(
  themeName: string,
  responses: Array<{id: string, comment: string, nps_score: number}>
): Promise<number> {
  
  // For now, use a simplified approach
  // In production, this would use AI classification for each response
  
  const themeKeywords = getThemeKeywords(themeName);
  let matches = 0;
  
  for (const response of responses) {
    if (response.comment && themeKeywords.some(keyword => 
      response.comment.toLowerCase().includes(keyword.toLowerCase())
    )) {
      matches++;
    }
  }
  
  return responses.length > 0 ? matches / responses.length : 0;
}

/**
 * Get keywords associated with a theme
 */
function getThemeKeywords(themeName: string): string[] {
  const keywordMap: Record<string, string[]> = {
    'content_kwaliteit': ['artikel', 'nieuws', 'kwaliteit', 'schrijven', 'journalistiek'],
    'pricing': ['prijs', 'kosten', 'duur', 'goedkoop', 'abonnement'],
    'merkvertrouwen': ['vertrouwen', 'geloofwaardig', 'betrouwbaar', 'reputatie'],
    'overige': ['andere', 'overig', 'divers'],
    'abonnement_beheer': ['abonnement', 'opzeggen', 'wijzigen', 'betalen'],
    'mobiele_app': ['app', 'mobiel', 'telefoon', 'smartphone'],
    'klantenservice': ['service', 'klantenservice', 'hulp', 'ondersteuning'],
    'nieuws_actualiteit': ['actueel', 'nieuws', 'tijdig', 'recent']
  };
  
  return keywordMap[themeName] || [themeName];
}

/**
 * Determine business relevance of a theme
 */
function determineBusinessRelevance(
  themeName: string,
  source: 'base' | 'ai_discovered'
): 'high' | 'medium' | 'low' {
  
  if (source === 'base') return 'high';
  
  const highRelevanceThemes = [
    'abonnement_beheer', 'klantenservice', 'mobiele_app', 
    'nieuws_actualiteit', 'website_gebruik'
  ];
  
  const mediumRelevanceThemes = [
    'content_kwaliteit', 'pricing', 'delivery'
  ];
  
  if (highRelevanceThemes.includes(themeName)) return 'high';
  if (mediumRelevanceThemes.includes(themeName)) return 'medium';
  return 'low';
}

/**
 * Filter and rank themes based on frequency and business relevance
 */
function filterAndRankThemes(
  themes: GeneratedTheme[],
  config: ThemeGenerationConfig
): GeneratedTheme[] {
  
  // Filter by minimum frequency
  const filtered = themes.filter(theme => 
    theme.frequency >= config.minThemeFrequency
  );
  
  // Sort by business relevance and frequency
  const sorted = filtered.sort((a, b) => {
    const relevanceScore = (theme: GeneratedTheme) => {
      const relevance = theme.businessRelevance === 'high' ? 3 : 
                       theme.businessRelevance === 'medium' ? 2 : 1;
      return relevance + theme.frequency;
    };
    
    return relevanceScore(b) - relevanceScore(a);
  });
  
  // Limit to max total themes
  return sorted.slice(0, config.maxTotalThemes);
}
