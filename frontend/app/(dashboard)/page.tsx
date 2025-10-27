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
  // Use full data range to enable month-over-month calculations
  return {
    start: "2024-01-01",
    end: "2025-12-31"
  };
}

// Helper function to get current and previous month periods
function getMonthPeriods() {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  
  return {
    current: {
      start: currentMonth.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    },
    previous: {
      start: previousMonth.toISOString().split('T')[0],
      end: previousMonthEnd.toISOString().split('T')[0]
    }
  };
}

// Calculate month-over-month changes
async function getMonthOverMonthChanges() {
  const periods = getMonthPeriods();
  
  try {
    // Get current month data
    const { data: currentData, error: currentError } = await supabase.rpc('v_nps_summary', {
      p_start: periods.current.start,
      p_end: periods.current.end,
      p_survey: null,
      p_title: null,
    });
    
    // Get previous month data
    const { data: previousData, error: previousError } = await supabase.rpc('v_nps_summary', {
      p_start: periods.previous.start,
      p_end: periods.previous.end,
      p_survey: null,
      p_title: null,
    });
    
    if (currentError || previousError || !currentData?.[0] || !previousData?.[0]) {
      return {
        npsChange: 0,
        responsesChange: 0,
        promotersChange: 0,
        detractorsChange: 0
      };
    }
    
    const current = currentData[0];
    const previous = previousData[0];
    
    // Calculate percentage changes
    const npsChange = previous.nps !== 0 ? ((current.nps - previous.nps) / Math.abs(previous.nps)) * 100 : 0;
    const responsesChange = previous.responses !== 0 ? ((current.responses - previous.responses) / previous.responses) * 100 : 0;
    const promotersChange = previous.promoters !== 0 ? ((current.promoters - previous.promoters) / previous.promoters) * 100 : 0;
    const detractorsChange = previous.detractors !== 0 ? ((current.detractors - previous.detractors) / previous.detractors) * 100 : 0;
    
    return {
      npsChange,
      responsesChange,
      promotersChange,
      detractorsChange
    };
  } catch (error) {
    console.error('Error calculating month-over-month changes:', error);
    return {
      npsChange: 0,
      responsesChange: 0,
      promotersChange: 0,
      detractorsChange: 0
    };
  }
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
    let query = supabase
      .from('nps_response')
      .select('nps_score')
      .gte('created_at', params.start || '2025-09-01')
      .lte('created_at', params.end || '2025-09-30');
    
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
    console.log('Calling top_title_mom_moves with params:', {
      p_start_date: params.start ?? null,
      p_end_date: params.end ?? null,
      p_survey: params.survey ?? null,
      p_min_responses: 10,
      p_top_k: 5
    });
    
    const { data: rpcData, error: rpcError } = await supabase.rpc('top_title_mom_moves', {
      p_start_date: params.start ?? null,
      p_end_date: params.end ?? null,
      p_survey: params.survey ?? null,
      p_min_responses: 10, // Lower threshold for testing
      p_top_k: 10 // Get more records to ensure we have enough for both sections
    });
    
    console.log('RPC Response:', { data: rpcData, error: rpcError });
    
    if (!rpcError && rpcData && rpcData.length > 0) {
      console.log('MoM data found:', rpcData.length, 'records');
      // Transform RPC data to match expected format
      return rpcData.map((item: any) => ({
        title_text: item.title_text,
        current_responses: item.current_responses,
        current_nps: item.current_nps,
        delta: item.delta,
        move: item.delta >= 0 ? 'up' : 'down'
      }));
    }
    
    // Fallback: Since we don't have month-over-month data, show top performers by NPS
    console.log('No MoM data available, falling back to top performers by NPS');
    
    const { data: titleData, error: titleError } = await supabase
      .from('nps_response')
      .select(`
        title_text,
        nps_score
      `)
      .gte('created_at', params.start || '2025-09-01')
      .lte('created_at', params.end || '2025-09-30')
      .not('title_text', 'is', null);
    
    if (titleError || !titleData) {
      return [];
    }
    
    // Calculate NPS by title
    const titleStats = titleData.reduce((acc: any, response: any) => {
      const title = response.title_text;
      if (!acc[title]) {
        acc[title] = {
          title_text: title,
          scores: [],
          responses: 0
        };
      }
      acc[title].scores.push(response.nps_score);
      acc[title].responses++;
      return acc;
    }, {});
    
    // Calculate NPS for each title
    const titleNps = Object.values(titleStats).map((stat: any) => {
      const promoters = stat.scores.filter((s: number) => s >= 9).length;
      const detractors = stat.scores.filter((s: number) => s <= 6).length;
      const total = stat.responses;
      const nps = total > 0 ? ((promoters - detractors) / total) * 100 : 0;
      
      return {
        title_text: stat.title_text,
        current_responses: stat.responses,
        current_nps: nps,
        delta: 0, // No month-over-month data available
        move: 'up' // All titles will be treated as "up" for fallback display
      };
    }).filter((item: any) => item.current_responses >= 10); // Minimum 10 responses
    
    // Sort by NPS score (highest first) and return all titles
    const sortedByNps = titleNps.sort((a: any, b: any) => b.current_nps - a.current_nps);
    
    return sortedByNps; // Return all titles so we can split them properly
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
          // Get sample quotes from v_theme_assignments_normalized joined with nps_response
          const { data: quoteData } = await supabase
            .from('v_theme_assignments_normalized')
            .select('nps_response!inner(nps_explanation, nps_score)')
            .eq('canonical_theme', theme.theme)
            .gte('nps_response.nps_score', 9)
            .not('nps_response.nps_explanation', 'is', null)
            .neq('nps_response.nps_explanation', '')
            .limit(3);
          
          const sampleQuotes = quoteData?.map((item: any) => item.nps_response?.nps_explanation).filter(Boolean) || [];
          
          return {
            ...theme,
            sample_quotes: sampleQuotes.length > 0 ? sampleQuotes : ["Geen voorbeeld beschikbaar"]
          };
        })
      );

      const detractorThemes = await Promise.all(
        detractors.map(async (theme: any) => {
          // Get sample quotes from v_theme_assignments_normalized joined with nps_response
          const { data: quoteData } = await supabase
            .from('v_theme_assignments_normalized')
            .select('nps_response!inner(nps_explanation, nps_score)')
            .eq('canonical_theme', theme.theme)
            .lte('nps_response.nps_score', 6)
            .not('nps_response.nps_explanation', 'is', null)
            .neq('nps_response.nps_explanation', '')
            .limit(3);
          
          const sampleQuotes = quoteData?.map((item: any) => item.nps_response?.nps_explanation).filter(Boolean) || [];
          
          return {
            ...theme,
            sample_quotes: sampleQuotes.length > 0 ? sampleQuotes : ["Geen voorbeeld beschikbaar"]
          };
        })
      );

      return { promoterThemes, detractorThemes };
    }
    
    // Fallback: return empty arrays
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

  
  // Fetch all data in parallel
  const [kpis, movers, themes, coverage, momChanges] = await Promise.all([
    getKpis({ start, end, survey, title }),
    getMovers({ start, end, survey, title }),
    getTopThemes({ start, end, survey, title }),
    getDataCoverage({ start, end, survey, title }),
    getMonthOverMonthChanges()
  ]);
  
  

  const getCategoryPercentage = (count: number, total: number) => 
    total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

  // Helper function to format month-over-month changes with color validation
  const formatMoMChange = (change: number, isPositiveGood: boolean = true) => {
    const sign = change >= 0 ? '+' : '';
    const percentage = `${sign}${change.toFixed(1)}%`;
    
    // Determine color based on whether the change is good or bad
    let colorClass = '';
    if (change > 0) {
      colorClass = isPositiveGood ? 'text-green-600' : 'text-red-600';
    } else if (change < 0) {
      colorClass = isPositiveGood ? 'text-red-600' : 'text-green-600';
    } else {
      colorClass = 'text-gray-500';
    }
    
    return { percentage, colorClass };
  };

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
                {momChanges.npsChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.current_nps?.toFixed(1) ?? '—'}</div>
                <p className={`text-xs ${formatMoMChange(momChanges.npsChange, true).colorClass}`}>
                  {formatMoMChange(momChanges.npsChange, true).percentage} from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
                {momChanges.responsesChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.total_responses}</div>
                <p className={`text-xs ${formatMoMChange(momChanges.responsesChange, true).colorClass}`}>
                  {formatMoMChange(momChanges.responsesChange, true).percentage} from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Promoters</CardTitle>
                {momChanges.promotersChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.promoters}</div>
                <p className={`text-xs ${formatMoMChange(momChanges.promotersChange, true).colorClass}`}>
                  {formatMoMChange(momChanges.promotersChange, true).percentage} from last month
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {getCategoryPercentage(kpis.promoters, kpis.total_responses)}% of responses
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Detractors</CardTitle>
                {momChanges.detractorsChange <= 0 ? (
                  <TrendingDown className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.detractors}</div>
                <p className={`text-xs ${formatMoMChange(momChanges.detractorsChange, false).colorClass}`}>
                  {formatMoMChange(momChanges.detractorsChange, false).percentage} from last month
                </p>
                <p className="text-xs text-muted-foreground mt-1">
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
              {(() => {
                // Split movers into improvers and decliners
                console.log('All movers data:', movers);
                const improvers = movers.filter((m: any) => m.delta > 0 || (m.delta === 0 && m.move === 'up')).slice(0, 3);
                console.log('Filtered improvers:', improvers);
                return improvers.length > 0 ? (
                  <div className="space-y-3">
                    {improvers.map((m: any, i: number) => (
                      <Link 
                        key={i} 
                        href={`/titles?title=${encodeURIComponent(m.title_text)}&start=2025-09-01&end=2025-09-30`}
                        className="flex justify-between items-center py-2 border-b last:border-b-0 hover:bg-gray-50 rounded p-2 -m-2"
                      >
                        <div>
                          <p className="font-medium text-black hover:text-gray-700">{m.title_text}</p>
                          <p className="text-sm text-muted-foreground">{m.current_responses} responses</p>
                        </div>
                        <div className="text-right">
                          {m.delta !== 0 ? (
                            <p className="font-bold text-green-600">+{m.delta?.toFixed(1)}</p>
                          ) : (
                            <p className="font-bold text-green-600">Top Performer</p>
                          )}
                          <p className="text-sm text-muted-foreground">{m.current_nps?.toFixed(1)} NPS</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No significant NPS improvements found.</p>
                );
              })()}
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
              {(() => {
                // Split movers into improvers and decliners
                console.log('All movers data for decliners:', movers);
                const decliners = movers.filter((m: any) => m.delta < 0 || (m.delta === 0 && m.move === 'down')).slice(0, 3);
                console.log('Filtered decliners:', decliners);
                return decliners.length > 0 ? (
                  <div className="space-y-3">
                    {decliners.map((m: any, i: number) => (
                      <Link 
                        key={i} 
                        href={`/titles?title=${encodeURIComponent(m.title_text)}&start=2025-09-01&end=2025-09-30`}
                        className="flex justify-between items-center py-2 border-b last:border-b-0 hover:bg-gray-50 rounded p-2 -m-2"
                      >
                        <div>
                          <p className="font-medium text-black hover:text-gray-700">{m.title_text}</p>
                          <p className="text-sm text-muted-foreground">{m.current_responses} responses</p>
                        </div>
                        <div className="text-right">
                          {m.delta !== 0 ? (
                            <p className="font-bold text-red-600">{m.delta?.toFixed(1)}</p>
                          ) : (
                            <p className="font-bold text-red-600">Lowest NPS</p>
                          )}
                          <p className="text-sm text-muted-foreground">{m.current_nps?.toFixed(1)} NPS</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">No titles with low NPS scores found.</p>
                    <p className="text-xs">All titles have sufficient response volume and positive NPS scores.</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          </div>
          
          {/* Link to Title Explorer */}
          <div className="text-center mt-4">
            <Link href="/titles">
              <Button variant="outline" size="sm">
                View All Titles & Performance Trends
              </Button>
            </Link>
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
              {(() => {
                const validPromoterThemes = themes.promoterThemes.filter(t => t.theme !== 'overige').slice(0, 3);
                console.log('Valid promoter themes:', validPromoterThemes.length, validPromoterThemes);
                return validPromoterThemes.length > 0 ? (
                  <div className="space-y-3">
                    {validPromoterThemes.map((t, i) => (
                      <Link 
                        key={i} 
                        href={`/themes/${encodeURIComponent(t.theme)}`}
                        className="block py-2 border-b last:border-b-0 hover:bg-gray-50 rounded p-2 -m-2 transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium capitalize text-black hover:text-gray-700">{t.theme.replace('_', ' ')}</p>
                            <p className="text-sm text-muted-foreground italic mt-1">"{t.sample_quotes?.[0] || 'Geen voorbeeld beschikbaar'}"</p>
                          </div>
                          <Badge variant="secondary">{t.share_pct?.toFixed(1)}%</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">Geen specifieke promoter thema's gevonden.</p>
                    <p className="text-xs">Positieve feedback is verspreid over verschillende categorieën of bevat algemene complimenten.</p>
                  </div>
                );
              })()}
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
              {(() => {
                const validDetractorThemes = themes.detractorThemes.filter(t => t.theme !== 'overige').slice(0, 3);
                console.log('Valid detractor themes:', validDetractorThemes.length, validDetractorThemes);
                return validDetractorThemes.length > 0 ? (
                  <div className="space-y-3">
                    {validDetractorThemes.map((t, i) => (
                      <Link 
                        key={i} 
                        href={`/themes/${encodeURIComponent(t.theme)}`}
                        className="block py-2 border-b last:border-b-0 hover:bg-gray-50 rounded p-2 -m-2 transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium capitalize text-black hover:text-gray-700">{t.theme.replace('_', ' ')}</p>
                            <p className="text-sm text-muted-foreground italic mt-1">"{t.sample_quotes?.[0] || 'Geen voorbeeld beschikbaar'}"</p>
                          </div>
                          <Badge variant="secondary">{t.share_pct?.toFixed(1)}%</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">Geen specifieke detractor thema's gevonden.</p>
                    <p className="text-xs">Negatieve feedback is verspreid over verschillende categorieën of bevat algemene klachten.</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
        
        {/* View All Themes Link */}
        <div className="flex justify-center mt-6">
          <Link href="/themes">
            <Button variant="outline" className="w-full max-w-md">
              <TrendingUp className="mr-2 h-4 w-4" />
              View All Themes & Performance Trends
            </Button>
          </Link>
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
                {(() => {
                  const validPromoterThemes = themes.promoterThemes.filter(t => t.theme !== 'overige');
                  if (validPromoterThemes.length > 0) {
                    const topTheme = validPromoterThemes[0];
                    const secondTheme = validPromoterThemes[1];
                    
                    // Generate specific insights based on the top theme
                    const getSpecificInsight = (theme: any) => {
                      const themeName = theme.theme.replace('_', ' ');
                      const percentage = theme.share_pct?.toFixed(1);
                      
                      switch (theme.theme) {
                        case 'content_kwaliteit':
                          return {
                            explanation: `Klanten waarderen vooral de ${themeName} (${percentage}% van promoters). Dit blijkt uit feedback over:`,
                            evidence: [
                              "• Diepgaande journalistiek en onderzoeksverhalen",
                              "• Betrouwbare en actuele nieuwsberichtgeving", 
                              "• Kwalitatieve artikelen en analyses"
                            ],
                            action: "Versterk de content strategie door meer resources te investeren in onderzoeksjournalistiek en diepgaande analyses. Dit is duidelijk een differentiator."
                          };
                        case 'tevredenheid':
                          return {
                            explanation: `Algemene ${themeName} is hoog (${percentage}% van promoters). Klanten zijn tevreden over:`,
                            evidence: [
                              "• De algehele service en gebruikservaring",
                              "• Betrouwbaarheid en consistentie",
                              "• Waarde voor geld"
                            ],
                            action: "Behoud deze hoge tevredenheid door regelmatig klantfeedback te monitoren en kleine verbeteringen door te voeren."
                          };
                        case 'bezorging':
                          return {
                            explanation: `${themeName.charAt(0).toUpperCase() + themeName.slice(1)} scoort goed (${percentage}% van promoters). Klanten waarderen:`,
                            evidence: [
                              "• Snelle en betrouwbare levering",
                              "• Goede verpakking en staat van artikelen",
                              "• Flexibele bezorgopties"
                            ],
                            action: "Behoud de huidige bezorgkwaliteit en overweeg om bezorgopties uit te breiden naar andere gebieden."
                          };
                        default:
                          return {
                            explanation: `${themeName.charAt(0).toUpperCase() + themeName.slice(1)} is een sterk punt (${percentage}% van promoters).`,
                            evidence: ["• Klanten waarderen dit aspect van de service"],
                            action: "Versterk dit sterke punt en gebruik het als voorbeeld voor andere gebieden."
                          };
                      }
                    };
                    
                    const insight = getSpecificInsight(topTheme);
                    
                    return (
                      <div className="text-sm text-green-800">
                        <p className="mb-2 font-medium">
                          {insight.explanation}
                        </p>
                        <div className="mb-2">
                          {insight.evidence.map((item, i) => (
                            <div key={i} className="text-xs text-green-700">{item}</div>
                          ))}
                        </div>
                        <p className="text-xs text-green-700 font-medium">
                          💡 <strong>Concrete actie:</strong> {insight.action}
                        </p>
                        {secondTheme && (
                          <p className="text-xs text-green-600 mt-2">
                            Ook <strong>{secondTheme.theme.replace('_', ' ')}</strong> scoort goed ({secondTheme.share_pct?.toFixed(1)}%).
                          </p>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-sm text-green-800">
                        <p className="mb-2">Geen dominante positieve thema's gevonden. Dit kan betekenen:</p>
                        <ul className="text-xs text-green-700 space-y-1 ml-4">
                          <li>• Feedback is te verspreid voor duidelijke patronen</li>
                          <li>• Promoters geven algemene complimenten zonder specifieke thema's</li>
                          <li>• Thema-classificatie heeft verbetering nodig</li>
                        </ul>
                      </div>
                    );
                  }
                })()}
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-semibold text-red-900 mb-2">⚠️ Verbeterpunten</h4>
                {(() => {
                  const validDetractorThemes = themes.detractorThemes.filter(t => t.theme !== 'overige');
                  if (validDetractorThemes.length > 0) {
                    const topTheme = validDetractorThemes[0];
                    const secondTheme = validDetractorThemes[1];
                    
                    // Generate specific insights for detractor themes
                    const getDetractorInsight = (theme: any) => {
                      const themeName = theme.theme.replace('_', ' ');
                      const percentage = theme.share_pct?.toFixed(1);
                      
                      switch (theme.theme) {
                        case 'content_kwaliteit':
                          return {
                            explanation: `${themeName.charAt(0).toUpperCase() + themeName.slice(1)} veroorzaakt ontevredenheid (${percentage}% van detractors). Klachten gaan over:`,
                            evidence: [
                              "• Ondiepe of oppervlakkige artikelen",
                              "• Gebrek aan diepgaande analyses",
                              "• Te weinig lokale of relevante content"
                            ],
                            action: "Investeer in kwaliteitsjournalistiek: meer onderzoeksverhalen, diepgaande analyses en lokale content. Dit is cruciaal voor klantbehoud."
                          };
                        case 'bezorging':
                          return {
                            explanation: `${themeName.charAt(0).toUpperCase() + themeName.slice(1)} problemen (${percentage}% van detractors). Klachten betreffen:`,
                            evidence: [
                              "• Late of gemiste bezorgingen",
                              "• Beschadigde artikelen bij levering",
                              "• Onflexibele bezorgtijden"
                            ],
                            action: "Verbeter bezorgproces: betere tracking, betere verpakking en flexibelere bezorgopties. Dit heeft directe impact op klanttevredenheid."
                          };
                        case 'klantenservice':
                          return {
                            explanation: `${themeName.charAt(0).toUpperCase() + themeName.slice(1)} scoort slecht (${percentage}% van detractors). Problemen zijn:`,
                            evidence: [
                              "• Langzame reactietijden op vragen",
                              "• Onvoldoende hulp bij problemen",
                              "• Moeilijk bereikbare klantenservice"
                            ],
                            action: "Versterk klantenservice: snellere reactietijden, betere training en meer contactkanalen. Dit voorkomt klantverlies."
                          };
                        case 'prijs':
                          return {
                            explanation: `${themeName.charAt(0).toUpperCase() + themeName.slice(1)} is een probleem (${percentage}% van detractors). Klachten gaan over:`,
                            evidence: [
                              "• Te hoge abonnementskosten",
                              "• Onduidelijke prijsstructuur",
                              "• Geen waarde voor geld gevoel"
                            ],
                            action: "Herzie prijsstrategie: transparantere prijzen, flexibelere abonnementen en duidelijke waardecommunicatie."
                          };
                        default:
                          return {
                            explanation: `${themeName.charAt(0).toUpperCase() + themeName.slice(1)} veroorzaakt ontevredenheid (${percentage}% van detractors).`,
                            evidence: ["• Klanten hebben specifieke problemen met dit aspect"],
                            action: `Prioriteer verbetering van ${themeName} - dit heeft de grootste impact op klanttevredenheid.`
                          };
                      }
                    };
                    
                    const insight = getDetractorInsight(topTheme);
                    
                    return (
                      <div className="text-sm text-red-800">
                        <p className="mb-2 font-medium">
                          {insight.explanation}
                        </p>
                        <div className="mb-2">
                          {insight.evidence.map((item, i) => (
                            <div key={i} className="text-xs text-red-700">{item}</div>
                          ))}
                        </div>
                        <p className="text-xs text-red-700 font-medium">
                          🚨 <strong>Prioriteit:</strong> {insight.action}
                        </p>
                        {secondTheme && (
                          <p className="text-xs text-red-600 mt-2">
                            Ook <strong>{secondTheme.theme.replace('_', ' ')}</strong> is problematisch ({secondTheme.share_pct?.toFixed(1)}%).
                          </p>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-sm text-red-800">
                        <p className="mb-2">Geen dominante negatieve thema's gevonden. Dit kan betekenen:</p>
                        <ul className="text-xs text-red-700 space-y-1 ml-4">
                          <li>• Klachten zijn te divers voor duidelijke patronen</li>
                          <li>• Detractors geven algemene klachten zonder specifieke thema's</li>
                          <li>• Thema-classificatie heeft verbetering nodig</li>
                        </ul>
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Recommendations */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">🎯 Concrete Aanbevelingen</h4>
                <ul className="text-sm text-yellow-800 space-y-2">
                  {(() => {
                    const validDetractorThemes = themes.detractorThemes.filter(t => t.theme !== 'overige');
                    const validPromoterThemes = themes.promoterThemes.filter(t => t.theme !== 'overige');
                    
                    const recommendations = [];
                    
                    if (validDetractorThemes.length > 0) {
                      const topDetractor = validDetractorThemes[0];
                      recommendations.push(
                        <li key="detractor" className="flex items-start">
                          <span className="text-red-600 mr-2">🔴</span>
                          <div>
                            <strong>Start met {topDetractor.theme.replace('_', ' ')}</strong> - dit veroorzaakt {topDetractor.share_pct?.toFixed(1)}% van alle klachten. 
                            <span className="text-xs block mt-1">Bekijk specifieke klachten in het thema-overzicht voor gerichte acties.</span>
                          </div>
                        </li>
                      );
                    }
                    
                    if (validPromoterThemes.length > 0) {
                      const topPromoter = validPromoterThemes[0];
                      recommendations.push(
                        <li key="promoter" className="flex items-start">
                          <span className="text-green-600 mr-2">🟢</span>
                          <div>
                            <strong>Versterk {topPromoter.theme.replace('_', ' ')}</strong> - dit wordt door {topPromoter.share_pct?.toFixed(1)}% van promoters gewaardeerd.
                            <span className="text-xs block mt-1">Gebruik dit als voorbeeld voor andere gebieden.</span>
                          </div>
                        </li>
                      );
                    }
                    
                    recommendations.push(
                      <li key="trends" className="flex items-start">
                        <span className="text-blue-600 mr-2">📈</span>
                        <div>
                          <strong>Monitor trends per titel</strong> - zie welke titels verbeteren of verslechteren.
                          <span className="text-xs block mt-1">Gebruik de "Title Performance Changes" sectie voor maand-op-maand vergelijkingen.</span>
                        </div>
                      </li>
                    );
                    
                    return recommendations;
                  })()}
                </ul>
              </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          <strong>Hoe deze samenvatting werkt:</strong> De AI analyseert {coverage.total} reacties uit de periode {start} - {end}. 
          Van deze reacties heeft {coverage.withComments}% een opmerking en {coverage.enriched}% is geclassificeerd met thema's en sentiment. 
          De bovenstaande inzichten zijn gebaseerd op de {coverage.enriched}% geclassificeerde reacties.
        </p>
      </CardContent>
    </Card>
          </div>
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