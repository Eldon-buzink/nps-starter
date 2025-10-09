import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import ThemesPageClient from "@/components/ThemesPageClient";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper function to get last full calendar month
function getLastFullMonth() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  
  return {
    start: lastMonth.toISOString().split('T')[0],
    end: lastDayOfLastMonth.toISOString().split('T')[0]
  };
}

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
    
    console.log(`Processed ${result.length} normalized themes with explanations:`, result.slice(0, 5));
    return result;
  } catch (error) {
    console.error('Error in getThemes:', error);
    return [];
  }
}

// Get promoters vs detractors data from normalized themes
async function getPromoterDetractorData(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    console.log('Getting promoter/detractor data from normalized themes');
    
    // Use the normalized view data that already includes promoter/detractor percentages
    const { data, error } = await supabase
      .from('v_theme_overview_normalized')
      .select('*')
      .order('mentions', { ascending: false });
    
    if (error) {
      console.error('Normalized promoter/detractor query error:', error);
      return [];
    }
    
    console.log(`Found ${data?.length || 0} normalized themes for promoter/detractor analysis`);
    
    // Transform the data to include actual counts
    const result = data?.map(row => ({
      theme: row.theme,
      promoters: Math.round((row.pct_promoters || 0) * row.mentions),
      detractors: Math.round((row.pct_detractors || 0) * row.mentions),
      total_responses: row.mentions
    })) || [];
    
    console.log(`Processed ${result.length} normalized themes for promoter/detractor analysis:`, result.slice(0, 5));
    return result;
  } catch (error) {
    console.error('Error in getPromoterDetractorData:', error);
    return [];
  }
}

// Get top 5 themes for sparklines
async function getTopThemesForSparklines(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    const themes = await getThemes(params);
    const top5Themes = themes.slice(0, 5);
    
    // For each theme, get monthly share data using normalized themes
    const sparklineData = await Promise.all(
      top5Themes.map(async (theme: any) => {
        // Get theme assignments for this normalized theme
        const { data: themeData, error: themeError } = await supabase
          .from('v_theme_assignments_normalized')
          .select(`
            canonical_theme,
            response_id,
            nps_response!inner(creation_date)
          `)
          .eq('canonical_theme', theme.theme)
          .gte('nps_response.creation_date', '2024-01-01')
          .lte('nps_response.creation_date', '2025-12-31');
        
        if (themeError) {
          console.error('Error fetching theme data:', themeError);
          return { theme: theme.theme, data: [] };
        }
        
        console.log(`Theme data for ${theme.theme}:`, { count: themeData?.length, data: themeData?.slice(0, 3) });
        
        // Group theme data by month (count unique responses, not theme assignments)
        const monthlyThemeData = themeData?.reduce((acc: any, row: any) => {
          const month = new Date(row.nps_response.creation_date).toISOString().substring(0, 7);
          if (!acc[month]) {
            acc[month] = new Set();
          }
          acc[month].add(row.response_id);
          return acc;
        }, {}) || {};
        
        // Convert sets to counts
        const monthlyThemeCounts = Object.keys(monthlyThemeData).reduce((acc: any, month: string) => {
          acc[month] = monthlyThemeData[month].size;
          return acc;
        }, {});
        
        // Calculate total responses across all themes for each month
        // This gives us a more accurate total for percentage calculation
        const { data: allThemeData, error: allThemeError } = await supabase
          .from('v_theme_assignments_normalized')
          .select(`
            response_id,
            nps_response!inner(creation_date)
          `)
          .gte('nps_response.creation_date', '2024-01-01')
          .lte('nps_response.creation_date', '2025-12-31');
        
        if (allThemeError) {
          console.error('Error fetching all theme data:', allThemeError);
          return { theme: theme.theme, data: [] };
        }
        
        // Group all theme data by month (unique responses across all themes)
        const monthlyTotalData = allThemeData?.reduce((acc: any, row: any) => {
          const month = new Date(row.nps_response.creation_date).toISOString().substring(0, 7);
          if (!acc[month]) {
            acc[month] = new Set();
          }
          acc[month].add(row.response_id);
          return acc;
        }, {}) || {};
        
        // Convert sets to counts
        const monthlyTotalCounts = Object.keys(monthlyTotalData).reduce((acc: any, month: string) => {
          acc[month] = monthlyTotalData[month].size;
          return acc;
        }, {});
        
        // Calculate share percentages and create sparkline points
        const sparklinePoints = Object.keys(monthlyTotalCounts).map(month => {
          const themeCount = monthlyThemeCounts[month] || 0;
          const totalCount = monthlyTotalCounts[month] || 0;
          const sharePct = totalCount > 0 ? (themeCount / totalCount) * 100 : 0;
          
          return {
            month,
            share_pct: sharePct
          };
        }).sort((a, b) => a.month.localeCompare(b.month));
        
        console.log(`Sparkline data for ${theme.theme}:`, {
          monthlyThemeCounts,
          monthlyTotalCounts,
          sparklinePoints
        });
        
        return {
          theme: theme.theme,
          data: sparklinePoints
        };
      })
    );
    
    return sparklineData;
  } catch (error) {
    console.error('Error in getTopThemesForSparklines:', error);
    return [];
  }
}


interface ThemesPageProps {
  searchParams: {
    start?: string;
    end?: string;
    survey?: string;
    title?: string;
  };
}

export default async function ThemesPage({ searchParams }: ThemesPageProps) {
  const { surveys, titles } = await getFilterOptions();
  
  // Get initial themes data
  const initialThemes = await getThemes({
    start: searchParams.start,
    end: searchParams.end,
    survey: searchParams.survey,
    title: searchParams.title
  });

  console.log('ThemesPage: Results:', { 
    themesCount: initialThemes.length,
    promoterDetractorCount: initialThemes.length,
    sparklineDataCount: 5
  });

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thema Analyse</h1>
          <p className="text-muted-foreground">
            Hier zie je welke onderwerpen klanten het meest noemen. Aandeel = % van alle thema-vermeldingen binnen de huidige filters.
          </p>
        </div>

        <ThemesPageClient 
          initialThemes={initialThemes}
          surveys={surveys} 
          titles={titles} 
        />
    </div>
  );
}