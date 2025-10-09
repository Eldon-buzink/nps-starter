import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Get themes data from normalized view with enhanced explanations
async function getThemes(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    console.log('getThemes called with params:', params);
    
    // Use the normalized view that handles synonyms and "Other (cluster)" collapsing
    // First get the filtered theme assignments to understand which themes are relevant
    let themeQuery = supabase
      .from('v_theme_assignments_normalized')
      .select(`
        canonical_theme,
        nps_response!inner(
          survey_name,
          title_text,
          creation_date
        )
      `);
    
    // Apply filters to the theme assignments
    if (params.start) {
      themeQuery = themeQuery.gte('nps_response.creation_date', params.start);
    }
    if (params.end) {
      themeQuery = themeQuery.lte('nps_response.creation_date', params.end);
    }
    if (params.survey) {
      themeQuery = themeQuery.eq('nps_response.survey_name', params.survey);
    }
    if (params.title) {
      themeQuery = themeQuery.eq('nps_response.title_text', params.title);
    }
    
    const { data: filteredAssignments, error: assignmentError } = await themeQuery;
    
    if (assignmentError) {
      console.error('Error fetching filtered theme assignments:', assignmentError);
      return [];
    }
    
    if (!filteredAssignments || filteredAssignments.length === 0) {
      console.log('No theme assignments found for the given filters');
      return [];
    }
    
    // Get unique themes from filtered assignments
    const themeCounts = new Map<string, number>();
    filteredAssignments.forEach(assignment => {
      const theme = assignment.canonical_theme;
      themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
    });
    
    // Now get the theme overview data for these themes
    const { data, error } = await supabase
      .from('v_theme_overview_normalized')
      .select('*')
      .in('theme', Array.from(themeCounts.keys()))
      .order('mentions', { ascending: false });
    
    if (error) {
      console.error('Normalized themes query error:', error);
      return [];
    }
    
    // Transform the data to match the expected format and add enhanced explanations
    const result = await Promise.all(data?.map(async (row) => {
      // Use filtered theme counts instead of raw mentions from the view
      const filteredMentions = themeCounts.get(row.theme) || 0;
      
      // Define the original base themes (the ones that were predefined)
      const baseThemes = ['content_kwaliteit', 'pricing', 'merkvertrouwen', 'overige'];
      const isBaseTheme = baseThemes.includes(row.theme);
      const isOtherCluster = row.theme === 'Other (cluster)';
      
      // Determine business relevance based on filtered mentions
      let businessRelevance: 'high' | 'medium' | 'low' = 'medium';
      if (filteredMentions >= 100) businessRelevance = 'high';
      else if (filteredMentions < 10) businessRelevance = 'low';

      let explanation = '';
      
      if (isOtherCluster) {
        explanation = 'Cluster of themes with fewer than 3 mentions each';
      } else if (isBaseTheme) {
        explanation = `Predefined business category for ${row.theme.replace('_', ' ')} feedback`;
      } else {
        // For AI themes, get sample keywords from actual responses
        try {
          const { data: sampleResponses } = await supabase
            .from('v_theme_assignments_normalized')
            .select(`
              nps_response!inner(nps_explanation)
            `)
            .eq('canonical_theme', row.theme)
            .limit(5);

          // Extract meaningful keywords from sample responses
          const keywords = new Set<string>();
          const stopWords = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'man', 'oil', 'sit', 'try', 'use', 'why', 'let', 'put', 'say', 'she', 'too', 'use',
            // Dutch stop words
            'een', 'van', 'de', 'het', 'is', 'op', 'te', 'in', 'aan', 'met', 'voor', 'dat', 'niet', 'zijn', 'als', 'er', 'maar', 'dan', 'ook', 'nog', 'over', 'heeft', 'hebben', 'wordt', 'worden', 'kan', 'kunnen', 'moet', 'moeten', 'zal', 'zullen', 'zou', 'zouden', 'heb', 'heeft', 'had', 'hadden', 'was', 'waren', 'ben', 'bent', 'is', 'zijn', 'dit', 'die', 'deze', 'dat', 'zo', 'wel', 'niet', 'geen', 'alle', 'alleen', 'altijd', 'al', 'ook', 'nog', 'weer', 'meer', 'veel', 'weinig', 'groot', 'klein', 'goed', 'slecht', 'nieuw', 'oud', 'jong', 'laat', 'vroeg', 'lang', 'kort', 'hoog', 'laag', 'breed', 'smal', 'dik', 'dun', 'warm', 'koud', 'hete', 'koude', 'nat', 'droog', 'schoon', 'vuil', 'mooi', 'lelijk', 'leuk', 'saai', 'interessant', 'belangrijk', 'nuttig', 'handig', 'makkelijk', 'moeilijk', 'duur', 'goedkoop', 'snel', 'langzaam', 'sterk', 'zwak', 'zwaar', 'licht', 'vol', 'leeg', 'open', 'dicht', 'binnen', 'buiten', 'boven', 'onder', 'links', 'rechts', 'voor', 'achter', 'naast', 'tussen', 'door', 'over', 'onder', 'boven', 'rond', 'om', 'naar', 'van', 'tot', 'sinds', 'tijdens', 'voor', 'na', 'tijd', 'uur', 'dag', 'week', 'maand', 'jaar', 'morgen', 'gisteren', 'vandaag', 'morgen', 'avond', 'ochtend', 'middag', 'nacht'
          ]);
          
          sampleResponses?.forEach((response: any) => {
            const text = response.nps_response.nps_explanation?.toLowerCase() || '';
            // Extract meaningful words (3+ characters, not common words)
            const words = text.match(/\b\w{3,}\b/g) || [];
            words.forEach((word: string) => {
              if (!stopWords.has(word) && word.length >= 3) {
                keywords.add(word);
              }
            });
          });

          const keywordList = Array.from(keywords).slice(0, 5);
          const keywordText = keywordList.length > 0 
            ? ` based on keywords like "${keywordList.join('", "')}"`
            : ' based on common patterns in customer feedback';

          explanation = `AI-discovered theme from customer feedback analysis${keywordText}. This theme emerged from multiple responses indicating ${row.theme.replace('_', ' ')} as a key concern.`;
        } catch (keywordError) {
          console.error('Error fetching keywords for theme:', row.theme, keywordError);
          explanation = `AI-discovered theme from customer feedback analysis. This theme emerged from multiple responses indicating ${row.theme.replace('_', ' ')} as a key concern.`;
        }
      }
      
      return {
        theme: row.theme,
        count_responses: filteredMentions,
        share_pct: filteredMentions > 0 ? Math.round((filteredMentions / (Array.from(themeCounts.values()).reduce((sum, count) => sum + count, 0))) * 100 * 10) / 10 : 0,
        avg_sentiment: Math.round((row.avg_sentiment || 0) * 100) / 100,
        avg_nps: Math.round((row.avg_nps || 0) * 10) / 10,
        pct_promoters: Math.round((row.pct_promoters || 0) * 100),
        pct_passives: Math.round((row.pct_passives || 0) * 100),
        pct_detractors: Math.round((row.pct_detractors || 0) * 100),
        pct_pos_sentiment: Math.round((row.pct_pos_sentiment || 0) * 100),
        pct_neg_sentiment: Math.round((row.pct_neg_sentiment || 0) * 100),
        // Add enhanced explanation data
        explanation,
        source: isBaseTheme ? 'base' as const : 'ai' as const,
        businessRelevance,
        frequency: filteredMentions / (Array.from(themeCounts.values()).reduce((sum, count) => sum + count, 0) || 1),
        confidence: isBaseTheme ? 1.0 : 0.8
      };
    }) || []);
    
    return result;
  } catch (error) {
    console.error('Error in getThemes:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const survey = searchParams.get('survey');
    const title = searchParams.get('title');

    const themes = await getThemes({ 
      start: start || undefined, 
      end: end || undefined, 
      survey: survey || undefined, 
      title: title || undefined 
    });

    return NextResponse.json({ themes });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch themes' }, { status: 500 });
  }
}
