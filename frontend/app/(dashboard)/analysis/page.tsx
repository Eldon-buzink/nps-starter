import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, MessageSquare, Target, AlertCircle, BarChart3, PieChart } from "lucide-react";
import Link from 'next/link';
import { TrendsChart } from '@/components/charts/TrendsChart';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper function to get last full calendar month
function getLastFullMonth() {
  // Use full dataset for analysis (needs historical data)
  return {
    start: "2024-01-01",
    end: "2025-12-31"
  };
}

// Get KPIs for specific title
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
        mom_delta: summary.mom_delta || 0,
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
      return { current_nps: 0, total_responses: 0, promoters: 0, passives: 0, detractors: 0, mom_delta: 0, avg_score: 0 };
    }
    
    const total = data?.length || 0;
    const promoters = data?.filter(r => r.nps_score >= 9).length || 0;
    const passives = data?.filter(r => r.nps_score >= 7 && r.nps_score <= 8).length || 0;
    const detractors = data?.filter(r => r.nps_score <= 6).length || 0;
    const current_nps = total > 0 ? ((promoters - detractors) / total) * 100 : 0;
    const avg_score = total > 0 ? data?.reduce((sum, r) => sum + (r.nps_score || 0), 0) / total : 0;
    
    return { current_nps, total_responses: total, promoters, passives, detractors, mom_delta: 0, avg_score };
  } catch (error) {
    console.error('Error in getKpis:', error);
    return { current_nps: 0, total_responses: 0, promoters: 0, passives: 0, detractors: 0, mom_delta: 0, avg_score: 0 };
  }
}

// Get trends for specific title
async function getTrends(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    // Try RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('nps_trend_overall', {
      p_start: params.start ?? null,
      p_end: params.end ?? null,
      p_survey: params.survey ?? null,
      p_title: params.title ?? null,
    });
    
    if (!rpcError && rpcData) {
      return rpcData;
    }
    
    // Fallback: get monthly data directly
    console.log('RPC failed, using direct query fallback for trends');
    let query = supabase
      .from('nps_response')
      .select('creation_date, nps_score')
      .gte('creation_date', params.start || '2024-01-01')
      .lte('creation_date', params.end || '2025-12-31')
      .not('title_text', 'is', null);
    
    if (params.title) {
      query = query.eq('title_text', params.title);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Fallback query error:', error);
      return [];
    }
    
    // Group by month and calculate NPS
    const monthlyData: { [key: string]: { responses: number[], month: string } } = {};
    
    data?.forEach(row => {
      const month = new Date(row.creation_date).toISOString().substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { responses: [], month };
      }
      monthlyData[month].responses.push(row.nps_score);
    });
    
    return Object.values(monthlyData).map(month => {
      const total = month.responses.length;
      const promoters = month.responses.filter(score => score >= 9).length;
      const detractors = month.responses.filter(score => score <= 6).length;
      const nps = total > 0 ? ((promoters - detractors) / total) * 100 : 0;
      
      return {
        month: new Date(month.month + '-01'),
        responses: total,
        nps: Math.round(nps * 10) / 10
      };
    }).sort((a, b) => a.month.getTime() - b.month.getTime());
  } catch (error) {
    console.error('Error in getTrends:', error);
    return [];
  }
}

// Get themes for specific title
async function getThemes(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    console.log('Getting themes from AI enrichment data with params:', params);
    let query = supabase
      .from('nps_ai_enrichment')
      .select('themes, sentiment_score, response_id, nps_response!inner(nps_score, creation_date, survey_name, title_text)')
      .gte('nps_response.creation_date', params.start || '2024-01-01')
      .lte('nps_response.creation_date', params.end || '2025-12-31')
      .not('themes', 'is', null);
    
    if (params.title) {
      query = query.eq('nps_response.title_text', params.title);
    }
    
    const { data, error } = await query;
    
    console.log('Themes query result:', { dataCount: data?.length, error });
    
    if (error) {
      console.error('Error fetching themes:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log('No themes data found');
      return [];
    }
    
    // Process themes data
    const themeMap: { [key: string]: { count: number, totalSentiment: number, totalNps: number, responses: Set<string> } } = {};
    
    data.forEach(row => {
      if (row.themes && Array.isArray(row.themes)) {
        row.themes.forEach(theme => {
          if (!themeMap[theme]) {
            themeMap[theme] = { count: 0, totalSentiment: 0, totalNps: 0, responses: new Set() };
          }
          themeMap[theme].count++;
          themeMap[theme].totalSentiment += row.sentiment_score || 0;
          themeMap[theme].totalNps += row.nps_response.nps_score || 0;
          themeMap[theme].responses.add(row.response_id);
        });
      }
    });
    
    const totalResponses = Object.values(themeMap).reduce((sum, theme) => sum + theme.responses.size, 0);
    
    return Object.entries(themeMap)
      .map(([theme, data]) => ({
        theme,
        count_responses: data.responses.size,
        share_pct: totalResponses > 0 ? (data.responses.size / totalResponses) * 100 : 0,
        avg_sentiment: data.count > 0 ? data.totalSentiment / data.count : 0,
        avg_nps: data.count > 0 ? data.totalNps / data.count : 0
      }))
      .sort((a, b) => b.count_responses - a.count_responses)
      .slice(0, 10);
  } catch (error) {
    console.error('Error in getThemes:', error);
    return [];
  }
}

// Get sample responses for specific title
async function getSampleResponses(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    let query = supabase
      .from('nps_response')
      .select(`
        id,
        creation_date,
        title_text,
        survey_name,
        nps_score,
        nps_explanation,
        nps_ai_enrichment (
          themes,
          sentiment_score,
          sentiment_label
        )
      `)
      .gte('creation_date', params.start || '2024-01-01')
      .lte('creation_date', params.end || '2025-12-31')
      .order('creation_date', { ascending: false });

    if (params.survey) {
      query = query.eq('survey_name', params.survey);
    }
    if (params.title) {
      query = query.eq('title_text', params.title);
    }

    const { data, error } = await query.limit(10);
    
    if (error) {
      console.error('Error fetching sample responses:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getSampleResponses:', error);
    return [];
  }
}

interface AnalysisPageProps {
  searchParams: {
    start?: string;
    end?: string;
    survey?: string;
    title?: string;
  };
}

export default async function AnalysisPage({ searchParams }: AnalysisPageProps) {
  const { surveys, titles } = await getFilterOptions();
  
  // Use provided dates or default to full dataset
  const defaultPeriod = getLastFullMonth();
  const start = searchParams?.start ?? defaultPeriod.start;
  const end = searchParams?.end ?? defaultPeriod.end;
  const survey = searchParams?.survey ?? null;
  const title = searchParams?.title ?? null;

  console.log('AnalysisPage: Fetching data with params:', { start, end, survey, title });
  
  // Fetch all data in parallel
  const [kpis, trends, themes, sampleResponses] = await Promise.all([
    getKpis({ start, end, survey, title }),
    getTrends({ start, end, survey, title }),
    getThemes({ start, end, survey, title }),
    getSampleResponses({ start, end, survey, title })
  ]);
  
  console.log('AnalysisPage: Results:', {
    kpis: kpis ? 'found' : 'null',
    trendsCount: trends?.length || 0,
    themesCount: themes?.length || 0,
    responsesCount: sampleResponses?.length || 0
  });

  const getCategoryPercentage = (count: number, total: number) => 
    total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Title Analysis</h1>
        <p className="text-muted-foreground">
          Diepgaande analyse per titel: prestaties, trends, thema's en reacties.
        </p>
      </div>

      <FiltersBar surveys={surveys} titles={titles} />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.current_nps?.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.mom_delta > 0 ? '+' : ''}{kpis.mom_delta?.toFixed(1)} van vorige maand
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.total_responses?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              In geselecteerde periode
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promoters</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.promoters}</div>
            <p className="text-xs text-muted-foreground">
              {getCategoryPercentage(kpis.promoters, kpis.total_responses)}% van reacties
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Detractors</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.detractors}</div>
            <p className="text-xs text-muted-foreground">
              {getCategoryPercentage(kpis.detractors, kpis.total_responses)}% van reacties
            </p>
          </CardContent>
        </Card>
      </div>

      {/* NPS Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>NPS Trends</CardTitle>
          <CardDescription>
            Maandelijkse NPS ontwikkeling voor {title || 'alle titels'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrendsChart data={trends} />
        </CardContent>
      </Card>

      {/* Theme Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Theme Performance</CardTitle>
          <CardDescription>
            Welke thema's zijn het belangrijkst voor {title || 'deze titel'}?
          </CardDescription>
        </CardHeader>
        <CardContent>
          {themes.length > 0 ? (
            <div className="space-y-3">
              {themes.slice(0, 5).map((theme, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium capitalize">{theme.theme.replace('_', ' ')}</p>
                    <p className="text-sm text-muted-foreground">
                      {theme.count_responses} reacties • 
                      Sentiment: {theme.avg_sentiment?.toFixed(2)} • 
                      Avg NPS: {theme.avg_nps?.toFixed(1)}
                    </p>
                  </div>
                  <Badge variant="secondary">{theme.share_pct?.toFixed(1)}%</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Geen thema data beschikbaar.</p>
          )}
        </CardContent>
      </Card>

      {/* Sample Responses */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Responses</CardTitle>
          <CardDescription>
            Laatste reacties voor {title || 'deze titel'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sampleResponses.length > 0 ? (
            <div className="space-y-4">
              {sampleResponses.slice(0, 5).map((response, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant={response.nps_score >= 9 ? "default" : response.nps_score <= 6 ? "destructive" : "secondary"}>
                        {response.nps_score}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(response.creation_date).toLocaleDateString('nl-NL')}
                      </span>
                    </div>
                    {response.nps_ai_enrichment?.themes && (
                      <div className="flex flex-wrap gap-1">
                        {response.nps_ai_enrichment.themes.slice(0, 2).map((theme: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {theme.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm">{response.nps_explanation}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Geen reacties beschikbaar.</p>
          )}
        </CardContent>
      </Card>

      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
          <CardDescription>
            AI-gegenereerde samenvatting en aanbevelingen voor {title || 'deze titel'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Key Metrics */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">📊 Huidige Performance</h4>
              <p className="text-sm text-blue-800">
                NPS Score: <strong>{kpis.current_nps?.toFixed(1)}</strong> • 
                {kpis.promoters} promoters ({getCategoryPercentage(kpis.promoters, kpis.total_responses)}%) • 
                {kpis.detractors} detractors ({getCategoryPercentage(kpis.detractors, kpis.total_responses)}%)
              </p>
            </div>

            {/* Top Themes */}
            {themes.length > 0 && (
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">🎯 Top Thema's</h4>
                <p className="text-sm text-green-800">
                  <strong>{themes[0]?.theme.replace('_', ' ')}</strong> is het belangrijkste thema ({themes[0]?.share_pct?.toFixed(1)}% van reacties).
                  {themes[1] && ` Ook ${themes[1].theme.replace('_', ' ')} is significant (${themes[1].share_pct?.toFixed(1)}%).`}
                </p>
              </div>
            )}

            {/* Recommendations */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">💡 Aanbevelingen</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• <strong>Focus op {themes[0]?.theme.replace('_', ' ')}</strong> - dit is het belangrijkste thema voor deze titel</li>
                <li>• <strong>Analyseer de trends</strong> om te zien of de NPS verbetert of verslechtert</li>
                <li>• <strong>Bekijk de reacties</strong> om specifieke verbeterpunten te identificeren</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
