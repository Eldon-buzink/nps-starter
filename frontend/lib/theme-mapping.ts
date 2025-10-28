/**
 * Client-side Theme Mapping System
 * 
 * This provides dynamic theme mapping without requiring database changes.
 * Works directly with your existing theme data structure.
 */

// Main category definitions
export const MAIN_CATEGORIES = {
  CONTENT: 'Content',
  PRICE: 'Price', 
  DELIVERY: 'Delivery',
  CUSTOMER_SERVICE: 'Customer Service',
  USER_EXPERIENCE: 'User Experience',
  OTHER: 'Other'
} as const

// Pattern-based mapping rules
export const THEME_PATTERNS: Record<string, {main: string, sub: string}> = {
  // Content-related patterns
  'content_kwaliteit': { main: MAIN_CATEGORIES.CONTENT, sub: 'Content Kwaliteit' },
  'actualiteit': { main: MAIN_CATEGORIES.CONTENT, sub: 'Actualiteit' },
  'leesbaarheid': { main: MAIN_CATEGORIES.CONTENT, sub: 'Leesbaarheid' },
  'merkvertrouwen': { main: MAIN_CATEGORIES.CONTENT, sub: 'Merkvertrouwen' },
  'objectiviteit': { main: MAIN_CATEGORIES.CONTENT, sub: 'Objectiviteit' },
  'kwaliteit': { main: MAIN_CATEGORIES.CONTENT, sub: 'Kwaliteit' },
  'duurzaamheid': { main: MAIN_CATEGORIES.CONTENT, sub: 'Duurzaamheid' },
  'betrouwbaarheid': { main: MAIN_CATEGORIES.CONTENT, sub: 'Betrouwbaarheid' },
  'innovatie': { main: MAIN_CATEGORIES.CONTENT, sub: 'Innovatie' },
  'communicatie': { main: MAIN_CATEGORIES.CONTENT, sub: 'Communicatie' },
  'journalistiek': { main: MAIN_CATEGORIES.CONTENT, sub: 'Journalistiek' },
  'inhoud': { main: MAIN_CATEGORIES.CONTENT, sub: 'Inhoud' },
  'artikel': { main: MAIN_CATEGORIES.CONTENT, sub: 'Artikelen' },
  'nieuws': { main: MAIN_CATEGORIES.CONTENT, sub: 'Nieuws' },
  'redactie': { main: MAIN_CATEGORIES.CONTENT, sub: 'Redactie' },
  'verhaal': { main: MAIN_CATEGORIES.CONTENT, sub: 'Verhalen' },
  'tekst': { main: MAIN_CATEGORIES.CONTENT, sub: 'Tekst' },
  'columnisten': { main: MAIN_CATEGORIES.CONTENT, sub: 'Columnisten' },
  'columnist': { main: MAIN_CATEGORIES.CONTENT, sub: 'Columnisten' },
  'column': { main: MAIN_CATEGORIES.CONTENT, sub: 'Columns' },
  'interessante onderwerpen': { main: MAIN_CATEGORIES.CONTENT, sub: 'Interessante Onderwerpen' },
  'onderwerpen': { main: MAIN_CATEGORIES.CONTENT, sub: 'Onderwerpen' },
  'onderwerp': { main: MAIN_CATEGORIES.CONTENT, sub: 'Onderwerp' },
  'interessant': { main: MAIN_CATEGORIES.CONTENT, sub: 'Interessante Content' },
  'rubriek': { main: MAIN_CATEGORIES.CONTENT, sub: 'Rubrieken' },
  'rubrieken': { main: MAIN_CATEGORIES.CONTENT, sub: 'Rubrieken' },
  'thema': { main: MAIN_CATEGORIES.CONTENT, sub: 'Thema' },
  'themas': { main: MAIN_CATEGORIES.CONTENT, sub: 'Thema\'s' },
  'variatie': { main: MAIN_CATEGORIES.CONTENT, sub: 'Variatie' },
  'analyses': { main: MAIN_CATEGORIES.CONTENT, sub: 'Analyses' },
  'natuur': { main: MAIN_CATEGORIES.CONTENT, sub: 'Natuur' },
  'interviews': { main: MAIN_CATEGORIES.CONTENT, sub: 'Interviews' },
  'milieu': { main: MAIN_CATEGORIES.CONTENT, sub: 'Milieu' },
  'gezondheid': { main: MAIN_CATEGORIES.CONTENT, sub: 'Gezondheid' },
  'diversiteit': { main: MAIN_CATEGORIES.CONTENT, sub: 'Diversiteit' },
  'taal': { main: MAIN_CATEGORIES.CONTENT, sub: 'Taal' },
  'schrijffouten': { main: MAIN_CATEGORIES.CONTENT, sub: 'Schrijffouten' },
  'taal- en schrijffouten': { main: MAIN_CATEGORIES.CONTENT, sub: 'Taal & Schrijffouten' },
  'spelling': { main: MAIN_CATEGORIES.CONTENT, sub: 'Spelling' },
  'grammatica': { main: MAIN_CATEGORIES.CONTENT, sub: 'Grammatica' },
  'fout': { main: MAIN_CATEGORIES.CONTENT, sub: 'Fouten' },
  'fouten': { main: MAIN_CATEGORIES.CONTENT, sub: 'Fouten' },
  'relevantie': { main: MAIN_CATEGORIES.CONTENT, sub: 'Relevantie' },
  'relevantie van inhoud': { main: MAIN_CATEGORIES.CONTENT, sub: 'Relevantie van Inhoud' },
  'relevante': { main: MAIN_CATEGORIES.CONTENT, sub: 'Relevantie' },
  'relevant': { main: MAIN_CATEGORIES.CONTENT, sub: 'Relevantie' },
  'sensatiegerichtheid': { main: MAIN_CATEGORIES.CONTENT, sub: 'Sensatiegerichtheid' },
  'sensatie': { main: MAIN_CATEGORIES.CONTENT, sub: 'Sensatie' },
  'sensationalisme': { main: MAIN_CATEGORIES.CONTENT, sub: 'Sensationalisme' },
  'dramatisch': { main: MAIN_CATEGORIES.CONTENT, sub: 'Dramatisch' },
  'drama': { main: MAIN_CATEGORIES.CONTENT, sub: 'Drama' },
  
  // Price-related patterns  
  'pricing': { main: MAIN_CATEGORIES.PRICE, sub: 'Prijzen' },
  'prijs': { main: MAIN_CATEGORIES.PRICE, sub: 'Prijs' },
  'facturering': { main: MAIN_CATEGORIES.PRICE, sub: 'Facturering' },
  'betaling': { main: MAIN_CATEGORIES.PRICE, sub: 'Betaling' },
  'kosten': { main: MAIN_CATEGORIES.PRICE, sub: 'Kosten' },
  'waarde': { main: MAIN_CATEGORIES.PRICE, sub: 'Waarde' },
  'abonnement': { main: MAIN_CATEGORIES.PRICE, sub: 'Abonnement' },
  'tarief': { main: MAIN_CATEGORIES.PRICE, sub: 'Tarief' },
  'betalen': { main: MAIN_CATEGORIES.PRICE, sub: 'Betalen' },
  
  // Delivery-related patterns
  'delivery': { main: MAIN_CATEGORIES.DELIVERY, sub: 'Bezorging' },
  'bezorging': { main: MAIN_CATEGORIES.DELIVERY, sub: 'Bezorging' },
  'levertijd': { main: MAIN_CATEGORIES.DELIVERY, sub: 'Levertijd' },
  'verpakking': { main: MAIN_CATEGORIES.DELIVERY, sub: 'Verpakking' },
  'levering': { main: MAIN_CATEGORIES.DELIVERY, sub: 'Levering' },
  'snelheid': { main: MAIN_CATEGORIES.DELIVERY, sub: 'Snelheid' },
  'bezorg': { main: MAIN_CATEGORIES.DELIVERY, sub: 'Bezorging' },
  'post': { main: MAIN_CATEGORIES.DELIVERY, sub: 'Post' },
  'tijd': { main: MAIN_CATEGORIES.DELIVERY, sub: 'Tijd' },
  
  // Customer Service patterns
  'support': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Support' },
  'klantenservice': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Klantenservice' },
  'contact': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Contact' },
  'reactietijd': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Reactietijd' },
  'service': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Service' },
  'hulp': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Hulp' },
  'medewerker': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Medewerkers' },
  'personeel': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Personeel' },
  'medewerkers': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Medewerkers' },
  'team': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Team' },
  'klachtenafhandeling': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Klachtenafhandeling' },
  'klacht': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Klachten' },
  'klachten': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Klachten' },
  'afhandeling': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Afhandeling' },
  'behandeling': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Behandeling' },
  'reactie': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Reactie' },
  'respons': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Respons' },
  'helpdesk': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Helpdesk' },
  'assistentie': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Assistentie' },
  'klantvriendelijkheid': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Klantvriendelijkheid' },
  'klantendienst': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Klantendienst' },
  'klant': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Klant' },
  'klanten': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Klanten' },
  'klantgericht': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Klantgericht' },
  'klantgerichtheid': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Klantgerichtheid' },
  'vriendelijk': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Vriendelijkheid' },
  'vriendelijkheid': { main: MAIN_CATEGORIES.CUSTOMER_SERVICE, sub: 'Vriendelijkheid' },
  
  // User Experience patterns
  'ux': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Gebruikerservaring' },
  'interface': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Interface' },
  'navigatie': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Navigatie' },
  'gebruiksvriendelijkheid': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Gebruiksvriendelijkheid' },
  'gebruiksvriendelijk': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Gebruiksvriendelijk' },
  'makkelijk': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Gebruiksgemak' },
  'moeilijk': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Moeilijkheid' },
  'design': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Design' },
  'app': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'App Ervaring' },
  'website': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Website Ervaring' },
  'platform': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Platform Ervaring' },
  'gebruikerservaring': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Gebruikerservaring' },
  'toegankelijkheid': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Toegankelijkheid' },
  'gebruiksgemak': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Gebruiksgemak' },
  'gebruik': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Gebruik' },
  'gebruiker': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Gebruiker' },
  'gebruikers': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Gebruikers' },
  'ervaring': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Ervaring' },
  'interactie': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Interactie' },
  'bediening': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Bediening' },
  'functionaliteit': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Functionaliteit' },
  'vormgeving': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Vormgeving' },
  'lay-out': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Layout' },
  'layout': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Layout' },
  'opmaak': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Opmaak' },
  'visueel': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Visueel' },
  'visuele': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Visueel' },
  
  // Technical patterns
  'technisch': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Technical Issues' },
  'probleem': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Problems' },
  'storing': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Technical Issues' },
  'uitval': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Downtime' },
  'bug': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Bugs' },
  'crash': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Crashes' },
  'werkt': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Functionality' },
  'werkt niet': { main: MAIN_CATEGORIES.USER_EXPERIENCE, sub: 'Not Working' },
  
  // General satisfaction patterns
  'tevreden': { main: MAIN_CATEGORIES.CONTENT, sub: 'Tevredenheid' },
  'blij': { main: MAIN_CATEGORIES.CONTENT, sub: 'Tevredenheid' },
  'positief': { main: MAIN_CATEGORIES.CONTENT, sub: 'Positieve Feedback' },
  'negatief': { main: MAIN_CATEGORIES.CONTENT, sub: 'Negatieve Feedback' },
  'ontevreden': { main: MAIN_CATEGORIES.CONTENT, sub: 'Ontevredenheid' },
  'goed': { main: MAIN_CATEGORIES.CONTENT, sub: 'Positieve Feedback' },
  'slecht': { main: MAIN_CATEGORIES.CONTENT, sub: 'Negatieve Feedback' },
  
  // Fallback - keep this last
  'overige': { main: MAIN_CATEGORIES.CONTENT, sub: 'Algemene Feedback' }
}

// Theme category colors for UI
export const THEME_COLORS: Record<string, string> = {
  [MAIN_CATEGORIES.CONTENT]: '#3B82F6',
  [MAIN_CATEGORIES.PRICE]: '#10B981', 
  [MAIN_CATEGORIES.DELIVERY]: '#F59E0B',
  [MAIN_CATEGORIES.CUSTOMER_SERVICE]: '#EF4444',
  [MAIN_CATEGORIES.USER_EXPERIENCE]: '#8B5CF6',
  [MAIN_CATEGORIES.OTHER]: '#6B7280'
}

export interface ThemeMapping {
  main: string
  sub: string
  confidence: number
  source: 'pattern' | 'ai' | 'fallback'
}

export interface ThemeHierarchy {
  main: string
  sub: string
  count: number
  avgNps: number
  sentiment: number
  themes: Array<{
    name: string
    count: number
    avgNps: number
    confidence: number
    source: string
  }>
}

/**
 * Get theme mapping using pattern matching
 */
export function getThemeMapping(themeName: string): ThemeMapping {
  // Handle undefined or null themeName
  if (!themeName || typeof themeName !== 'string') {
    return {
      main: MAIN_CATEGORIES.OTHER,
      sub: 'Unknown',
      confidence: 0,
      source: 'fallback'
    }
  }
  
  const normalized = themeName.toLowerCase().trim()
  
  // Direct match
  if (THEME_PATTERNS[normalized]) {
    return {
      ...THEME_PATTERNS[normalized],
      confidence: 0.95,
      source: 'pattern'
    }
  }

  // Enhanced partial matching with better logic
  for (const [pattern, mapping] of Object.entries(THEME_PATTERNS)) {
    // Skip the fallback pattern
    if (pattern === 'overige') continue;
    
    // Check if theme contains pattern or pattern contains theme
    if (normalized.includes(pattern) || pattern.includes(normalized)) {
      return {
        ...mapping,
        confidence: 0.75,
        source: 'pattern'
      }
    }
    
    // Check for word boundaries (e.g., "ux" matches "ux" but not "luxury")
    const words = normalized.split(/[_\s-]+/);
    for (const word of words) {
      if (word === pattern) {
        return {
          ...mapping,
          confidence: 0.85,
          source: 'pattern'
        }
      }
    }
  }

  // Additional smart matching for common Dutch patterns
  if (normalized.includes('kwaliteit') || normalized.includes('quality') || 
      normalized.includes('inhoud') || normalized.includes('content') ||
      normalized.includes('onderwerp') || normalized.includes('topic') ||
      normalized.includes('artikel') || normalized.includes('column') ||
      normalized.includes('variatie') || normalized.includes('analyse') ||
      normalized.includes('natuur') || normalized.includes('interview') ||
      normalized.includes('milieu') || normalized.includes('gezondheid') ||
      normalized.includes('diversiteit') || normalized.includes('onderwijs')) {
    return {
      main: MAIN_CATEGORIES.CONTENT,
      sub: 'Quality',
      confidence: 0.8,
      source: 'pattern'
    }
  }
  
  if (normalized.includes('prijs') || normalized.includes('price') || normalized.includes('cost')) {
    return {
      main: MAIN_CATEGORIES.PRICE,
      sub: 'Cost',
      confidence: 0.8,
      source: 'pattern'
    }
  }
  
  if (normalized.includes('bezorg') || normalized.includes('deliver') || normalized.includes('levering')) {
    return {
      main: MAIN_CATEGORIES.DELIVERY,
      sub: 'Delivery',
      confidence: 0.8,
      source: 'pattern'
    }
  }
  
  if (normalized.includes('service') || normalized.includes('support') || normalized.includes('help') || 
      normalized.includes('klacht') || normalized.includes('contact') || normalized.includes('reactie') ||
      normalized.includes('klant') || normalized.includes('customer') || normalized.includes('vriendelijk')) {
    return {
      main: MAIN_CATEGORIES.CUSTOMER_SERVICE,
      sub: 'Service',
      confidence: 0.8,
      source: 'pattern'
    }
  }
  
  if (normalized.includes('design') || normalized.includes('interface') || normalized.includes('user') ||
      normalized.includes('gebruiker') || normalized.includes('ervaring') || normalized.includes('toegank') ||
      normalized.includes('gebruik') || normalized.includes('interactie') || normalized.includes('bediening') ||
      normalized.includes('vormgeving') || normalized.includes('layout') || normalized.includes('lay-out')) {
    return {
      main: MAIN_CATEGORIES.USER_EXPERIENCE,
      sub: 'User Experience',
      confidence: 0.8,
      source: 'pattern'
    }
  }

  // Fallback
  return {
    main: MAIN_CATEGORIES.OTHER,
    sub: 'Uncategorized',
    confidence: 0.1,
    source: 'fallback'
  }
}

/**
 * Create hierarchical theme structure from flat theme data
 */
export function createThemeHierarchy(themes: Array<{
  theme: string
  count: number
  avgNps: number
  sentiment?: number
}>): ThemeHierarchy[] {
  
  // Group themes by main category
  const hierarchyMap = new Map<string, ThemeHierarchy>()
  
  themes.forEach(themeData => {
    const mapping = getThemeMapping(themeData.theme)
    const key = `${mapping.main}|${mapping.sub}`
    
    if (!hierarchyMap.has(key)) {
      hierarchyMap.set(key, {
        main: mapping.main,
        sub: mapping.sub,
        count: 0,
        avgNps: 0,
        sentiment: 0,
        themes: []
      })
    }
    
    const hierarchy = hierarchyMap.get(key)!
    hierarchy.count += themeData.count
    hierarchy.avgNps = (hierarchy.avgNps + themeData.avgNps) / 2 // Simple average
    hierarchy.sentiment = (hierarchy.sentiment + (themeData.sentiment || 0)) / 2
    hierarchy.themes.push({
      name: themeData.theme,
      count: themeData.count,
      avgNps: themeData.avgNps,
      confidence: mapping.confidence,
      source: mapping.source
    })
  })
  
  // Convert to array and sort
  return Array.from(hierarchyMap.values())
    .sort((a, b) => b.count - a.count)
}

/**
 * Get theme mapping for a specific theme
 */
export function getThemeCategory(themeName: string): { main: string, sub: string, color: string } {
  const mapping = getThemeMapping(themeName)
  return {
    main: mapping.main,
    sub: mapping.sub,
    color: THEME_COLORS[mapping.main] || THEME_COLORS[MAIN_CATEGORIES.OTHER]
  }
}

/**
 * Get source icon for theme mapping
 */
export function getSourceIcon(source: string): string {
  switch (source) {
    case 'pattern': return '🎯'
    case 'ai': return '🤖'
    case 'fallback': return '❓'
    default: return '❓'
  }
}

/**
 * Get source color for theme mapping
 */
export function getSourceColor(source: string): string {
  switch (source) {
    case 'pattern': return 'bg-blue-100 text-blue-800'
    case 'ai': return 'bg-green-100 text-green-800'
    case 'fallback': return 'bg-gray-100 text-gray-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}
