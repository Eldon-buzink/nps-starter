import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getThemeMapping } from "@/lib/theme-mapping";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Get themes data from normalized view with enhanced explanations
async function getThemes(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    console.log('getThemes called with params:', params);
    
    // Use the normalized view that handles synonyms and "Other (cluster)" collapsing
    let query = supabase
      .from('v_theme_overview_normalized')
      .select('*');
    
    // Apply filters
    if (params.start && params.end) {
      query = query.gte('period_start', params.start).lte('period_end', params.end);
    }
    if (params.survey) {
      query = query.eq('survey_name', params.survey);
    }
    if (params.title) {
      query = query.eq('title_text', params.title);
    }
    
    const { data, error } = await query.order('mentions', { ascending: false });
    
    if (error) {
      console.error('Normalized themes query error:', error);
      return [];
    }
    
    // Transform the data to match the expected format and add enhanced explanations
    const result = await Promise.all(data?.map(async (row) => {
      // Define the original base themes (the ones that were predefined)
      const baseThemes = ['content_kwaliteit', 'pricing', 'merkvertrouwen', 'overige'];
      
      // Get theme name from the correct field (try different possible field names)
      const themeName = row.canonical_theme || row.theme || row.name || 'unknown_theme';
      
      // Determine if this is a base theme or AI-discovered
      const isBaseTheme = baseThemes.includes(themeName);
      
      // Enhanced explanation generation for AI themes
      let explanation = '';
      if (isBaseTheme) {
        explanation = `Predefined business category for ${themeName} feedback`;
      } else {
        // For AI themes, create a more detailed explanation
        const keywords = row.keywords || [];
        const topKeywords = keywords.slice(0, 5).join(', ');
        explanation = `AI-discovered theme from customer feedback analysis based on keywords like "${topKeywords}". This theme emerged from multiple responses indicating ${themeName} as a key concern.`;
      }
      
      return {
        theme: themeName,
        count_responses: row.mentions || 0,
        share_pct: row.share_pct || 0,
        avg_sentiment: row.avg_sentiment || 0,
        avg_nps: row.avg_nps || 0,
        pct_promoters: row.pct_promoters || 0,
        pct_passives: row.pct_passives || 0,
        pct_detractors: row.pct_detractors || 0,
        pct_pos_sentiment: row.pct_pos_sentiment || 0,
        pct_neg_sentiment: row.pct_neg_sentiment || 0,
        explanation,
        source: isBaseTheme ? 'base' as const : 'ai' as const,
        businessRelevance: row.mentions > 100 ? 'high' as const : row.mentions > 50 ? 'medium' as const : 'low' as const,
        frequency: row.share_pct / 100 || 0,
        confidence: isBaseTheme ? 1 : 0.8
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
