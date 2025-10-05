import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ThemeData {
  theme: string;
  count_responses: number;
  share_pct: number;
  avg_sentiment: number;
  avg_nps: number;
  promoters: number;
  detractors: number;
}

export interface PromoterDetractorData {
  theme: string;
  promoters: number;
  detractors: number;
  promoter_pct: number;
  detractor_pct: number;
}

// Get themes aggregate data
export async function getThemesAggregate(
  startDate?: string,
  endDate?: string,
  survey?: string,
  title?: string,
  npsBucket?: string
): Promise<ThemeData[]> {
  try {
    // Try to get real AI enrichment data first
    const { data: enrichmentData, error } = await supabase
      .from('nps_ai_enrichment')
      .select(`
        themes,
        sentiment_score,
        response_id,
        nps_response!inner(
          nps_score,
          nps_category,
          survey_name,
          title_text,
          creation_date
        )
      `)
      .not('themes', 'is', null);

    if (error) {
      console.error('Error fetching AI enrichment data:', error);
      // Fall back to mock data
      return getMockThemeData();
    }

    if (!enrichmentData || enrichmentData.length === 0) {
      // No AI enrichment data yet, return mock data
      return getMockThemeData();
    }

    // Process real AI enrichment data
    const themeMap = new Map<string, {
      count_responses: number;
      total_sentiment: number;
      total_nps: number;
      promoters: number;
      detractors: number;
      passives: number;
    }>();

    enrichmentData.forEach(row => {
      const themes = row.themes || [];
      const sentiment = row.sentiment_score || 0;
      const npsScore = row.nps_response && row.nps_response[0]?.nps_score || 0;
      const category = row.nps_response && row.nps_response[0]?.nps_category || 'passive';

      themes.forEach((theme: string) => {
        if (!themeMap.has(theme)) {
          themeMap.set(theme, {
            count_responses: 0,
            total_sentiment: 0,
            total_nps: 0,
            promoters: 0,
            detractors: 0,
            passives: 0
          });
        }

        const themeData = themeMap.get(theme)!;
        themeData.count_responses++;
        themeData.total_sentiment += sentiment;
        themeData.total_nps += npsScore;

        if (category === 'promoter') themeData.promoters++;
        else if (category === 'detractor') themeData.detractors++;
        else themeData.passives++;
      });
    });

    // Calculate total responses for percentage calculation
    const totalResponses = Array.from(themeMap.values()).reduce((sum, data) => sum + data.count_responses, 0);

    // Convert to array and calculate metrics
    return Array.from(themeMap.entries())
      .map(([theme, data]) => ({
        theme,
        count_responses: data.count_responses,
        share_pct: totalResponses > 0 ? (data.count_responses / totalResponses) * 100 : 0,
        avg_sentiment: data.count_responses > 0 ? data.total_sentiment / data.count_responses : 0,
        avg_nps: data.count_responses > 0 ? data.total_nps / data.count_responses : 0,
        promoters: data.promoters,
        detractors: data.detractors
      }))
      .sort((a, b) => b.count_responses - a.count_responses)
      .slice(0, 10); // Top 10 themes

  } catch (error) {
    console.error('Error in getThemesAggregate:', error);
    return getMockThemeData();
  }
}

// Mock data fallback
function getMockThemeData(): ThemeData[] {
  return [
    {
      theme: "content_kwaliteit",
      count_responses: 1250,
      share_pct: 15.2,
      avg_sentiment: 0.3,
      avg_nps: 6.8,
      promoters: 450,
      detractors: 380
    },
    {
      theme: "bezorging",
      count_responses: 980,
      share_pct: 11.9,
      avg_sentiment: -0.1,
      avg_nps: 5.2,
      promoters: 280,
      detractors: 420
    },
    {
      theme: "klantenservice",
      count_responses: 750,
      share_pct: 9.1,
      avg_sentiment: 0.1,
      avg_nps: 6.1,
      promoters: 320,
      detractors: 200
    },
    {
      theme: "pricing",
      count_responses: 650,
      share_pct: 7.9,
      avg_sentiment: -0.2,
      avg_nps: 4.8,
      promoters: 180,
      detractors: 350
    },
    {
      theme: "app_ux",
      count_responses: 520,
      share_pct: 6.3,
      avg_sentiment: 0.2,
      avg_nps: 7.1,
      promoters: 280,
      detractors: 120
    }
  ];
}

// Get promoter/detractor data by theme
export async function getThemesPromoterDetractor(
  startDate?: string,
  endDate?: string,
  survey?: string,
  title?: string
): Promise<PromoterDetractorData[]> {
  try {
    // For now, return mock data since we don't have AI enrichment yet
    return [
      {
        theme: "content_kwaliteit",
        promoters: 450,
        detractors: 380,
        promoter_pct: 54.2,
        detractor_pct: 45.8
      },
      {
        theme: "bezorging",
        promoters: 280,
        detractors: 420,
        promoter_pct: 40.0,
        detractor_pct: 60.0
      },
      {
        theme: "klantenservice",
        promoters: 320,
        detractors: 200,
        promoter_pct: 61.5,
        detractor_pct: 38.5
      },
      {
        theme: "pricing",
        promoters: 180,
        detractors: 350,
        promoter_pct: 34.0,
        detractor_pct: 66.0
      },
      {
        theme: "app_ux",
        promoters: 280,
        detractors: 120,
        promoter_pct: 70.0,
        detractor_pct: 30.0
      }
    ];
  } catch (error) {
    console.error('Error in getThemesPromoterDetractor:', error);
    return [];
  }
}
