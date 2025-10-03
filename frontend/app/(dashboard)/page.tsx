import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Users, MessageSquare, Target, AlertCircle, Tag } from "lucide-react";
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper function to get last full calendar month
function getLastFullMonth() {
  // Use full dataset for movers analysis (needs historical data)
  return {
    start: "2024-01-01",
    end: "2025-12-31"
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
      const summary = rpcData[0];
      return {
        current_nps: summary.nps || 0,
        total_responses: summary.responses || 0,
        promoters: summary.promoters || 0,
        passives: summary.passives || 0,
        detractors: summary.detractors || 0,
        avg_score: 0 // RPC doesn't return avg_score
      };
    }
    
    // Fallback to direct query
    console.log('RPC failed, using direct query fallback');
    let query = supabase
      .from('nps_response')
      .select('nps_score')
      .gte('creation_date', params.start || '2024-01-01')
      .lte('creation_date', params.end || '2025-12-31');
    
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
    console.log('getMovers called with params:', params);
    
    // Try RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('top_title_mom_moves', {
      p_start_date: params.start ?? null,
      p_end_date: params.end ?? null,
      p_survey: params.survey ?? null,
      p_title: params.title ?? null,
      p_min_responses: 30,
      p_top_k: 5
    });
    
    console.log('getMovers RPC result:', { rpcData, rpcError });
    
    if (!rpcError && rpcData) {
      console.log('getMovers returning RPC data:', rpcData.length, 'items');
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
          // Get sample quote from v_theme_assignments_normalized joined with nps_response
          const { data: quoteData } = await supabase
            .from('v_theme_assignments_normalized')
            .select('nps_response!inner(nps_explanation, nps_score)')
            .eq('canonical_theme', theme.theme)
            .gte('nps_response.nps_score', 9)
            .not('nps_response.nps_explanation', 'is', null)
            .neq('nps_response.nps_explanation', '')
            .limit(1);
          
          return {
            ...theme,
            sample_quote: (quoteData?.[0] as any)?.nps_response?.nps_explanation || "Geen voorbeeld beschikbaar"
          };
        })
      );

      const detractorThemes = await Promise.all(
        detractors.map(async (theme: any) => {
          // Get sample quote from v_theme_assignments_normalized joined with nps_response
          const { data: quoteData } = await supabase
            .from('v_theme_assignments_normalized')
            .select('nps_response!inner(nps_explanation, nps_score)')
            .eq('canonical_theme', theme.theme)
            .lte('nps_response.nps_score', 6)
            .not('nps_response.nps_explanation', 'is', null)
            .neq('nps_response.nps_explanation', '')
            .limit(1);
          
          return {
            ...theme,
            sample_quote: (quoteData?.[0] as any)?.nps_response?.nps_explanation || "Geen voorbeeld beschikbaar"
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

    const total = (totalData as any)?.count || 0;
    const withComments = (commentsData as any)?.count || 0;
    const enriched = (enrichedData as any)?.count || 0;

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
    moversData: movers,
    themesCount: (themes?.promoterThemes?.length || 0) + (themes?.detractorThemes?.length || 0),
    coverage: coverage ? 'found' : 'null'
  });
  
  // Client-side debugging
  if (typeof window !== 'undefined') {
    console.log('CLIENT: HomePage movers data:', movers);
    console.log('CLIENT: HomePage movers length:', movers?.length);
    console.log('CLIENT: HomePage movers type:', typeof movers);
  }

  const getCategoryPercentage = (count: number, total: number) => 
    total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-8">
        {/* Header Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Monthly Overview
          </h1>
          <p className="text-muted-foreground">
            Month-over-month changes in NPS performance. Track which titles and themes are improving or declining to understand what drives customer satisfaction.
          </p>
        </div>

        {/* Current Performance Overview */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Current Performance Overview</h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.current_nps?.toFixed(1) ?? '—'}</div>
                <p className="text-xs text-muted-foreground">
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
        </div>

        {/* Title Movers - Primary Focus */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Title Performance Changes</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-green-600">Biggest NPS Improvers</CardTitle>
                <CardDescription>
                  Titles with the largest NPS increases this month
                </CardDescription>
              </CardHeader>
            <CardContent>
              {movers.filter((m: any) => m.delta > 0).length > 0 ? (
                <div className="space-y-3">
                  {movers.filter((m: any) => m.delta > 0).map((m: any, i: number) => (
                    <Link 
                      key={i} 
                      href={`/titles/${encodeURIComponent(m.title_text)}`}
                      className="flex justify-between items-center py-2 border-b last:border-b-0 hover:bg-gray-50 rounded p-2 -m-2"
                    >
                      <div>
                        <p className="font-medium text-black hover:text-gray-700">{m.title_text}</p>
                        <p className="text-sm text-muted-foreground">{m.current_responses} responses</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">+{m.delta?.toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">{m.current_nps?.toFixed(1)} NPS</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No significant NPS improvements found.</p>
              )}
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-red-600">Biggest NPS Decliners</CardTitle>
              <CardDescription>
                Titles with the largest NPS decreases this month
              </CardDescription>
            </CardHeader>
            <CardContent>
              {movers.filter((m: any) => m.delta < 0).length > 0 ? (
                <div className="space-y-3">
                  {movers.filter((m: any) => m.delta < 0).map((m: any, i: number) => (
                    <Link 
                      key={i} 
                      href={`/titles/${encodeURIComponent(m.title_text)}`}
                      className="flex justify-between items-center py-2 border-b last:border-b-0 hover:bg-gray-50 rounded p-2 -m-2"
                    >
                      <div>
                        <p className="font-medium text-black hover:text-gray-700">{m.title_text}</p>
                        <p className="text-sm text-muted-foreground">{m.current_responses} responses</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">{m.delta?.toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">{m.current_nps?.toFixed(1)} NPS</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No significant NPS declines found.</p>
              )}
            </CardContent>
          </Card>
          </div>
        </div>

        {/* Theme Movers - Secondary Focus */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Theme Performance Changes</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-green-600">Top Promoter Themes</CardTitle>
                <CardDescription>
                  Themes driving positive feedback this month
                </CardDescription>
              </CardHeader>
            <CardContent>
              {themes.promoterThemes.length > 0 ? (
                <div className="space-y-3">
                  {themes.promoterThemes.map((t, i) => (
                    <Link 
                      key={i} 
                      href={`/themes/${encodeURIComponent(t.theme)}`}
                      className="block py-2 border-b last:border-b-0 hover:bg-gray-50 rounded p-2 -m-2 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium capitalize text-black hover:text-gray-700">{t.theme.replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground italic mt-1">"{t.sample_quote}"</p>
                        </div>
                        <Badge variant="secondary">{t.share_pct?.toFixed(1)}%</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No promoter themes identified.</p>
              )}
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-red-600">Top Detractor Themes</CardTitle>
              <CardDescription>
                Themes driving negative feedback this month
              </CardDescription>
            </CardHeader>
            <CardContent>
              {themes.detractorThemes.length > 0 ? (
                <div className="space-y-3">
                  {themes.detractorThemes.map((t, i) => (
                    <Link 
                      key={i} 
                      href={`/themes/${encodeURIComponent(t.theme)}`}
                      className="block py-2 border-b last:border-b-0 hover:bg-gray-50 rounded p-2 -m-2 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium capitalize text-black hover:text-gray-700">{t.theme.replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground italic mt-1">"{t.sample_quote}"</p>
                        </div>
                        <Badge variant="secondary">{t.share_pct?.toFixed(1)}%</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No detractor themes identified.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
          
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Explore All Titles</h3>
                    <p className="text-sm text-muted-foreground">Browse and analyze all titles and their performance</p>
                  </div>
                  <Link href="/titles">
                    <Button variant="outline" size="sm">
                      View Titles
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Tag className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Explore All Themes</h3>
                    <p className="text-sm text-muted-foreground">Browse and analyze all themes across your data</p>
                  </div>
                  <Link href="/themes">
                    <Button variant="outline" size="sm">
                      View Themes
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Browse Responses</h3>
                    <p className="text-sm text-muted-foreground">Read individual customer feedback and responses</p>
                  </div>
                  <Link href="/responses">
                    <Button variant="outline" size="sm">
                      View Responses
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Executive Summary</h2>
          
          <Card>
            <CardHeader>
              <CardTitle>AI-gegenereerde samenvatting</CardTitle>
              <CardDescription>
                Een AI-gegenereerde samenvatting van de belangrijkste inzichten uit de feedback.
              </CardDescription>
            </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Key Metrics */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">📊 Huidige Performance</h4>
                <p className="text-sm text-blue-800">
                  NPS Score: <strong>{kpis.current_nps?.toFixed(1)}</strong> • 
                  {kpis.promoters} promoters ({((kpis.promoters / kpis.total_responses) * 100).toFixed(1)}%) • 
                  {kpis.detractors} detractors ({((kpis.detractors / kpis.total_responses) * 100).toFixed(1)}%)
                </p>
              </div>

              {/* Actionable Insights */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">✅ Wat gaat goed?</h4>
                {themes.promoterThemes.length > 0 ? (
                  <p className="text-sm text-green-800">
                    Promoters waarderen vooral <strong>{themes.promoterThemes[0].theme.replace('_', ' ')}</strong> ({themes.promoterThemes[0].share_pct?.toFixed(1)}%). 
                    {themes.promoterThemes[1] && ` Ook ${themes.promoterThemes[1].theme.replace('_', ' ')} wordt positief genoemd (${themes.promoterThemes[1].share_pct?.toFixed(1)}%).`}
                  </p>
                ) : (
                  <p className="text-sm text-green-800">Geen specifieke promoter thema's geïdentificeerd.</p>
                )}
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-semibold text-red-900 mb-2">⚠️ Verbeterpunten</h4>
                {themes.detractorThemes.length > 0 ? (
                  <p className="text-sm text-red-800">
                    Detractors klagen vooral over <strong>{themes.detractorThemes[0].theme.replace('_', ' ')}</strong> ({themes.detractorThemes[0].share_pct?.toFixed(1)}%). 
                    {themes.detractorThemes[1] && ` Ook ${themes.detractorThemes[1].theme.replace('_', ' ')} is een probleem (${themes.detractorThemes[1].share_pct?.toFixed(1)}%).`}
                  </p>
                ) : (
                  <p className="text-sm text-red-800">Geen specifieke detractor thema's geïdentificeerd.</p>
                )}
              </div>

              {/* Recommendations */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">🎯 Aanbevelingen</h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• <strong>Focus op {themes.detractorThemes[0]?.theme.replace('_', ' ')}</strong> - dit is de grootste bron van ontevredenheid</li>
                  <li>• <strong>Behoud {themes.promoterThemes[0]?.theme.replace('_', ' ')}</strong> - dit is wat promoters waarderen</li>
                  <li>• <strong>Analyseer de trends</strong> om te zien welke titels verbeteren of verslechteren</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Hoe deze inzichten werken: De AI analyseert de opmerkingen en identificeert terugkerende thema's en sentimenten.
        </p>
      </CardContent>
    </Card>
          </div>
        </div>

        {/* Data Coverage */}
        <div className="text-sm text-muted-foreground text-right">
          In deze periode: {coverage.total} reacties • {coverage.withComments}% met opmerking • {coverage.enriched}% geclassificeerd.
        </div>

        {/* Footer */}
        <footer className="border-t pt-6 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
            <div className="space-y-2">
              <h3 className="font-semibold">NPS Insights Dashboard</h3>
              <p className="text-sm text-muted-foreground">
                Real-time NPS analytics en AI-powered insights voor betere klanttevredenheid.
              </p>
            </div>
            <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-6 text-sm text-muted-foreground">
              <div>
                <strong>Data periode:</strong> {start} - {end}
              </div>
              <div>
                <strong>Laatste update:</strong> {new Date().toLocaleDateString('nl-NL')}
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }