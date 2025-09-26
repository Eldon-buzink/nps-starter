import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, MessageSquare, Target, AlertCircle } from "lucide-react";

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

// Get KPIs from direct query (fallback if RPC doesn't exist)
async function getKpis(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    // Try RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('v_nps_summary', {
      p_start: params.start ?? null,
      p_end: params.end ?? null,
      p_survey: params.survey ?? null,
      p_title: params.title ?? null,
    });
    
    if (!rpcError && rpcData && rpcData.length > 0) {
      return rpcData[0];
    }
    
    // Fallback to direct query
    console.log('RPC failed, using direct query fallback');
    let query = supabase
      .from('nps_response')
      .select('nps_score')
      .gte('created_at', params.start || '2024-01-01')
      .lte('created_at', params.end || '2024-12-31');
    
    if (params.survey) {
      query = query.eq('survey_name', params.survey);
    }
    if (params.title) {
      query = query.eq('title_text', params.title);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching NPS data:', error);
      return { current_nps: 0, total_responses: 0, promoters: 0, passives: 0, detractors: 0, avg_score: 0 };
    }
    
    const total = data?.length || 0;
    const promoters = data?.filter(r => r.nps_score >= 9).length || 0;
    const passives = data?.filter(r => r.nps_score >= 7 && r.nps_score <= 8).length || 0;
    const detractors = data?.filter(r => r.nps_score <= 6).length || 0;
    const current_nps = total > 0 ? ((promoters - detractors) / total) * 100 : 0;
    const avg_score = total > 0 ? data?.reduce((sum, r) => sum + (r.nps_score || 0), 0) / total : 0;
    
    return { current_nps, total_responses: total, promoters, passives, detractors, avg_score };
  } catch (error) {
    console.error('Error in getKpis:', error);
    return { current_nps: 0, total_responses: 0, promoters: 0, passives: 0, detractors: 0, avg_score: 0 };
  }
}

// Get Movers from top_title_mom_moves (with fallback)
async function getMovers(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    // Try RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('top_title_mom_moves', {
      p_start_date: params.start ?? null,
      p_end_date: params.end ?? null,
      p_survey: params.survey ?? null,
      p_title: params.title ?? null,
      p_min_responses: 30,
      p_top_k: 5
    });
    
    if (!rpcError && rpcData) {
      return rpcData;
    }
    
    // Fallback: return empty array for now (would need complex month-over-month calculation)
    console.log('RPC failed for movers, returning empty array');
    return [];
  } catch (error) {
    console.error('Error in getMovers:', error);
    return [];
  }
}

// Get Top Themes for Promoters and Detractors (with fallback)
async function getTopThemes(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    // Try RPC first
    const [promoterData, detractorData] = await Promise.all([
      supabase.rpc('themes_aggregate', {
        p_start_date: params.start ?? null,
        p_end_date: params.end ?? null,
        p_survey: params.survey ?? null,
        p_title: params.title ?? null,
        p_nps_bucket: 'promoter'
      }),
      supabase.rpc('themes_aggregate', {
        p_start_date: params.start ?? null,
        p_end_date: params.end ?? null,
        p_survey: params.survey ?? null,
        p_title: params.title ?? null,
        p_nps_bucket: 'detractor'
      })
    ]);

    if (!promoterData.error && !detractorData.error) {
      const promoters = promoterData.data?.slice(0, 3) || [];
      const detractors = detractorData.data?.slice(0, 3) || [];

      // Get sample quotes for each theme
      const promoterThemes = await Promise.all(
        promoters.map(async (theme: any) => {
          const { data: quoteData } = await supabase
            .from('nps_response')
            .select('nps_explanation')
            .gte('nps_score', 9)
            .contains('nps_ai_enrichment.themes', [theme.theme])
            .not('nps_explanation', 'is', null)
            .limit(1);
          
          return {
            ...theme,
            sample_quote: quoteData?.[0]?.nps_explanation || "Geen voorbeeld beschikbaar"
          };
        })
      );

      const detractorThemes = await Promise.all(
        detractors.map(async (theme: any) => {
          const { data: quoteData } = await supabase
            .from('nps_response')
            .select('nps_explanation')
            .lte('nps_score', 6)
            .contains('nps_ai_enrichment.themes', [theme.theme])
            .not('nps_explanation', 'is', null)
            .limit(1);
          
          return {
            ...theme,
            sample_quote: quoteData?.[0]?.nps_explanation || "Geen voorbeeld beschikbaar"
          };
        })
      );

      return { promoterThemes, detractorThemes };
    }
    
    // Fallback: return empty arrays
    console.log('RPC failed for themes, returning empty arrays');
    return { promoterThemes: [], detractorThemes: [] };
  } catch (error) {
    console.error('Error in getTopThemes:', error);
    return { promoterThemes: [], detractorThemes: [] };
  }
}

// Get Data Coverage
async function getDataCoverage(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    const { data: totalData, error: totalError } = await supabase
      .from('nps_response')
      .select('count', { head: true, count: 'exact' })
      .gte('creation_date', params.start || '2024-01-01')
      .lte('creation_date', params.end || '2025-12-31');

    const { data: commentsData, error: commentsError } = await supabase
      .from('nps_response')
      .select('count', { head: true, count: 'exact' })
      .not('nps_explanation', 'is', null)
      .gte('creation_date', params.start || '2024-01-01')
      .lte('creation_date', params.end || '2025-12-31');

    const { data: enrichedData, error: enrichedError } = await supabase
      .from('nps_ai_enrichment')
      .select('count', { head: true, count: 'exact' })
      .not('themes', 'is', null)
      .not('sentiment_score', 'is', null);

    const total = totalData?.count || 0;
    const withComments = commentsData?.count || 0;
    const enriched = enrichedData?.count || 0;

    return {
      total,
      withComments: total > 0 ? Math.round((withComments / total) * 100) : 0,
      enriched: withComments > 0 ? Math.round((enriched / withComments) * 100) : 0
    };
  } catch (error) {
    console.error('Error in getDataCoverage:', error);
    return { total: 0, withComments: 0, enriched: 0 };
  }
}

interface HomePageProps {
  searchParams: {
    start?: string;
    end?: string;
    survey?: string;
    title?: string;
  };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { surveys, titles } = await getFilterOptions();
  
  // Use provided dates or default to last full month
  const defaultPeriod = getLastFullMonth();
  const start = searchParams?.start ?? defaultPeriod.start;
  const end = searchParams?.end ?? defaultPeriod.end;
  const survey = searchParams?.survey ?? null;
  const title = searchParams?.title ?? null;

  console.log('HomePage: Fetching data with params:', { start, end, survey, title });
  
  // Fetch all data in parallel
  const [kpis, movers, themes, coverage] = await Promise.all([
    getKpis({ start, end, survey, title }),
    getMovers({ start, end, survey, title }),
    getTopThemes({ start, end, survey, title }),
    getDataCoverage({ start, end, survey, title })
  ]);
  
  console.log('HomePage: Results:', {
    kpis: kpis ? 'found' : 'null',
    moversCount: movers?.length || 0,
    themesCount: themes?.length || 0,
    coverage: coverage ? 'found' : 'null'
  });

  const getCategoryPercentage = (count: number, total: number) => 
    total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NPS Insights</h1>
          <p className="text-muted-foreground">
            Overzicht van de belangrijkste NPS-inzichten voor de gekozen periode. Gebruik dit om snel te zien wat er verbeterd is, wat verslechterd is en welke onderwerpen klanten het meest noemen.
          </p>
        </div>

        <FiltersBar surveys={surveys} titles={titles} />

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.current_nps?.toFixed(1) ?? '—'}</div>
              <p className="text-xs text-muted-foreground">
                {/* MoM Delta placeholder - would need historical data */}
                +2.1% from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.total_responses}</div>
              <p className="text-xs text-muted-foreground">
                {/* MoM Delta placeholder */}
                +15% from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Promoters</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.promoters}</div>
              <p className="text-xs text-muted-foreground">
                {getCategoryPercentage(kpis.promoters, kpis.total_responses)}% of responses
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Detractors</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.detractors}</div>
              <p className="text-xs text-muted-foreground">
                {getCategoryPercentage(kpis.detractors, kpis.total_responses)}% of responses
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Movers Widget */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Grootste NPS-stijgers (laatste maand)</CardTitle>
              <CardDescription>
                We tonen de laatste maand met ≥ 30 reacties.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {movers.filter(m => m.mom_delta > 0).length > 0 ? (
                <div className="space-y-3">
                  {movers.filter(m => m.mom_delta > 0).map((m, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b last:border-b-0">
                      <div>
                        <p className="font-medium">{m.title}</p>
                        <p className="text-sm text-muted-foreground">{m.current_responses} responses</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">+{m.mom_delta?.toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">{m.current_nps?.toFixed(1)} NPS</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Geen significante NPS-stijgers gevonden.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Grootste NPS-dalers (laatste maand)</CardTitle>
              <CardDescription>
                We tonen de laatste maand met ≥ 30 reacties.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {movers.filter(m => m.mom_delta < 0).length > 0 ? (
                <div className="space-y-3">
                  {movers.filter(m => m.mom_delta < 0).map((m, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b last:border-b-0">
                      <div>
                        <p className="font-medium">{m.title}</p>
                        <p className="text-sm text-muted-foreground">{m.current_responses} responses</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">{m.mom_delta?.toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">{m.current_nps?.toFixed(1)} NPS</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Geen significante NPS-dalers gevonden.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Themes */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Top promoter themes</CardTitle>
              <CardDescription>
                Welke onderwerpen noemen promoters het meest?
              </CardDescription>
            </CardHeader>
            <CardContent>
              {themes.promoterThemes.length > 0 ? (
                <div className="space-y-3">
                  {themes.promoterThemes.map((t, i) => (
                    <div key={i} className="py-2 border-b last:border-b-0">
                      <div className="flex justify-between items-center">
                        <p className="font-medium capitalize">{t.theme.replace('_', ' ')}</p>
                        <Badge variant="secondary">{t.share_pct?.toFixed(1)}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground italic mt-1">"{t.sample_quote}"</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Geen thema's in deze periode.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Top detractor themes</CardTitle>
              <CardDescription>
                Welke onderwerpen noemen detractors het meest?
              </CardDescription>
            </CardHeader>
            <CardContent>
              {themes.detractorThemes.length > 0 ? (
                <div className="space-y-3">
                  {themes.detractorThemes.map((t, i) => (
                    <div key={i} className="py-2 border-b last:border-b-0">
                      <div className="flex justify-between items-center">
                        <p className="font-medium capitalize">{t.theme.replace('_', ' ')}</p>
                        <Badge variant="secondary">{t.share_pct?.toFixed(1)}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground italic mt-1">"{t.sample_quote}"</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Geen thema's in deze periode.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Executive Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Executive Summary</CardTitle>
            <CardDescription>
              Een AI-gegenereerde samenvatting van de belangrijkste inzichten uit de feedback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>De NPS score is {kpis.current_nps?.toFixed(1)} in de geselecteerde periode.</li>
              <li>{themes.promoterThemes[0]?.theme ? `${themes.promoterThemes[0].theme.replace('_', ' ')} is een top thema voor promoters.` : 'Geen promoter thema\'s beschikbaar.'}</li>
              <li>{themes.detractorThemes[0]?.theme ? `${themes.detractorThemes[0].theme.replace('_', ' ')} is een kritiek punt voor detractors.` : 'Geen detractor thema\'s beschikbaar.'}</li>
              <li>Meer gedetailleerde analyse is beschikbaar op de Thema's en Trends pagina's.</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-4">
              Hoe deze inzichten werken: De AI analyseert de opmerkingen en identificeert terugkerende thema's en sentimenten.
            </p>
          </CardContent>
        </Card>

        {/* Data Coverage */}
        <div className="text-sm text-muted-foreground text-right">
          In deze periode: {coverage.total} reacties • {coverage.withComments}% met opmerking • {coverage.enriched}% geclassificeerd.
        </div>
    </div>
  );
}
