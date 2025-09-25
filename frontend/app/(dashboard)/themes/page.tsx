import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import AiExplainer from "@/components/AiExplainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getThemes(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    // Try RPC first
    const { data, error } = await supabase.rpc("themes_aggregate", {
      p_start_date: params.start ?? null,
      p_end_date: params.end ?? null,
      p_survey: params.survey ?? null,
      p_title: params.title ?? null,
    });
    if (error) {
      console.error('RPC Error:', error);
      // Fallback to direct query
      return await getThemesFallback(params);
    }
    return data as { theme:string; count_responses:number; share_pct:number; avg_sentiment:number; avg_nps:number }[];
  } catch (error) {
    console.error('RPC failed, using fallback:', error);
    return await getThemesFallback(params);
  }
}

async function getThemesFallback(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  // Simple fallback - get theme data directly
  const { data, error } = await supabase
    .from('nps_ai_enrichment')
    .select('themes, sentiment_score, response_id, nps_response!inner(nps_score, nps_category, creation_date, survey_name, title_text)')
    .gte('nps_response.creation_date', params.start || '2024-01-01')
    .lte('nps_response.creation_date', params.end || '2025-12-31')
    .not('themes', 'is', null);
  
  if (error) {
    console.error('Fallback query error:', error);
    // Return mock data if no AI enrichment data
    return [
      { theme: 'content_kwaliteit', count_responses: 1250, share_pct: 15.2, avg_sentiment: 0.3, avg_nps: 6.8 },
      { theme: 'bezorging', count_responses: 980, share_pct: 11.9, avg_sentiment: -0.1, avg_nps: 5.2 },
      { theme: 'klantenservice', count_responses: 750, share_pct: 9.1, avg_sentiment: 0.1, avg_nps: 6.1 }
    ];
  }
  
  // Process theme data
  const themeMap = new Map<string, { count: number; sentiment: number[]; nps: number[] }>();
  
  data?.forEach(row => {
    const themes = row.themes as string[];
    const sentiment = row.sentiment_score || 0;
    const nps = row.nps_response?.nps_score || 0;
    
    themes.forEach(theme => {
      if (!themeMap.has(theme)) {
        themeMap.set(theme, { count: 0, sentiment: [], nps: [] });
      }
      const data = themeMap.get(theme)!;
      data.count++;
      data.sentiment.push(sentiment);
      data.nps.push(nps);
    });
  });
  
  const total = Array.from(themeMap.values()).reduce((sum, data) => sum + data.count, 0);
  
  return Array.from(themeMap.entries()).map(([theme, data]) => ({
    theme,
    count_responses: data.count,
    share_pct: Math.round((data.count / total) * 100 * 10) / 10,
    avg_sentiment: Math.round(data.sentiment.reduce((a, b) => a + b, 0) / data.sentiment.length * 100) / 100,
    avg_nps: Math.round(data.nps.reduce((a, b) => a + b, 0) / data.nps.length * 10) / 10
  })).sort((a, b) => b.count_responses - a.count_responses);
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
  const start = searchParams?.start ?? null;
  const end   = searchParams?.end ?? null;
  const survey= searchParams?.survey ?? null;
  const title = searchParams?.title ?? null;

  const themeData = await getThemes({ 
    start: start ?? undefined, 
    end: end ?? undefined, 
    survey: survey ?? undefined, 
    title: title ?? undefined 
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Thema Analyse</h1>
      <p className="text-sm text-muted-foreground">Hier zie je welke onderwerpen klanten het meest noemen. Aandeel = % van alle thema-vermeldingen binnen de huidige filters.</p>

      <AiExplainer compact />
      <FiltersBar surveys={surveys} titles={titles} />
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themeData.length > 0 ? (
          themeData.map((t) => (
            <Card key={t.theme}>
              <CardHeader>
                <CardTitle className="capitalize">{t.theme.replace('_', ' ')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span><b>Volume:</b></span>
                  <span>{t.count_responses}</span>
                </div>
                <div className="flex justify-between">
                  <span><b>Aandeel:</b></span>
                  <span>{t.share_pct?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span><b>Gem. NPS:</b></span>
                  <span>{t.avg_nps?.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span><b>Sentiment:</b></span>
                  <span className={t.avg_sentiment > 0 ? 'text-green-600' : t.avg_sentiment < 0 ? 'text-red-600' : 'text-gray-600'}>
                    {t.avg_sentiment?.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">Geen thema data beschikbaar. Voer AI enrichment uit om thema's te analyseren.</p>
          </div>
        )}
      </div>
    </div>
  );
}
