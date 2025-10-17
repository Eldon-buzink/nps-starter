import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, MessageSquare, Target, AlertCircle, ArrowLeft, Tag } from "lucide-react";
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Get title-specific KPIs
async function getTitleKpis(title: string, params: {start?:string,end?:string,survey?:string|null}) {
  try {
    let query = supabase
      .from('nps_response')
      .select('nps_score')
      .eq('title_text', title)
      .gte('created_at', params.start || '2024-01-01')
      .lte('created_at', params.end || '2025-12-31');
    
    if (params.survey) {
      query = query.eq('survey_name', params.survey);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching title NPS data:', error);
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
    console.error('Error in getTitleKpis:', error);
    return { current_nps: 0, total_responses: 0, promoters: 0, passives: 0, detractors: 0, avg_score: 0 };
  }
}

// Get themes for this title
async function getTitleThemes(title: string, params: {start?:string,end?:string,survey?:string|null}) {
  try {
    // Get all themes that have assignments for this title
    const { data, error } = await supabase
      .from('v_theme_assignments_normalized')
      .select(`
        canonical_theme,
        nps_response!inner(title_text, nps_score, created_at)
      `)
      .eq('nps_response.title_text', title)
      .gte('nps_response.created_at', params.start || '2024-01-01')
      .lte('nps_response.created_at', params.end || '2025-12-31');

    if (error) {
      console.error('Error fetching title themes:', error);
      return [];
    }

    // Group by theme and calculate metrics
    const themeMap = new Map();
    data?.forEach((item: any) => {
      const theme = item.canonical_theme;
      if (!themeMap.has(theme)) {
        themeMap.set(theme, {
          theme,
          title_mentions: 0,
          promoters: 0,
          passives: 0,
          detractors: 0,
          nps_scores: []
        });
      }
      
      const themeData = themeMap.get(theme);
      themeData.title_mentions++;
      themeData.nps_scores.push(item.nps_response.nps_score);
      
      if (item.nps_response.nps_score >= 9) themeData.promoters++;
      else if (item.nps_response.nps_score >= 7) themeData.passives++;
      else themeData.detractors++;
    });

    // Calculate NPS, avg score, and add metadata for each theme
    const themes = Array.from(themeMap.values()).map(themeData => {
      const avg_score = themeData.nps_scores.reduce((sum: number, score: number) => sum + score, 0) / themeData.nps_scores.length;
      
      // Determine source and business relevance based on theme name
      const isBaseTheme = ['content_kwaliteit', 'overige', 'pricing', 'delivery'].includes(themeData.theme);
      const source = isBaseTheme ? 'base' : 'ai';
      const businessRelevance = themeData.title_mentions >= 5 ? 'high' : 'low';
      
      // Generate explanation based on theme
      let explanation = '';
      if (source === 'base') {
        explanation = `Predefined business category for ${themeData.theme.replace('_', ' ')} feedback`;
      } else {
        explanation = `AI-discovered theme from customer feedback analysis. This theme emerged from multiple responses indicating ${themeData.theme.replace('_', ' ')} as a key concern.`;
      }
      
      return {
        ...themeData,
        nps: themeData.title_mentions > 0 ? ((themeData.promoters - themeData.detractors) / themeData.title_mentions) * 100 : 0,
        avg_score,
        avg_sentiment: avg_score >= 7 ? 0.5 : avg_score >= 5 ? 0 : -0.5, // Simple sentiment based on avg score
        source,
        businessRelevance,
        explanation
      };
    });

    return themes.sort((a, b) => b.title_mentions - a.title_mentions).slice(0, 10); // Top 10 themes for this title
  } catch (error) {
    console.error('Error in getTitleThemes:', error);
    return [];
  }
}

// Get sample responses for this title
async function getTitleResponses(title: string, params: {start?:string,end?:string,survey?:string|null}) {
  try {
    let query = supabase
      .from('nps_response')
      .select('id, nps_score, nps_explanation, created_at')
      .eq('title_text', title)
      .gte('created_at', params.start || '2024-01-01')
      .lte('created_at', params.end || '2025-12-31')
      .not('nps_explanation', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (params.survey) {
      query = query.eq('survey_name', params.survey);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching title responses:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getTitleResponses:', error);
    return [];
  }
}

interface TitlePageProps {
  params: {
    title: string;
  };
  searchParams: {
    start?: string;
    end?: string;
    survey?: string;
  };
}

export default async function TitlePage({ params, searchParams }: TitlePageProps) {
  const title = decodeURIComponent(params.title);
  const { surveys } = await getFilterOptions();
  
  // Use provided dates or default to last full month
  const start = searchParams?.start ?? '2024-01-01';
  const end = searchParams?.end ?? '2025-12-31';
  const survey = searchParams?.survey ?? null;

  console.log('TitlePage: Fetching data for title:', title, 'with params:', { start, end, survey });
  
  // Fetch all data in parallel
  const [kpis, themes, responses] = await Promise.all([
    getTitleKpis(title, { start, end, survey }),
    getTitleThemes(title, { start, end, survey }),
    getTitleResponses(title, { start, end, survey })
  ]);
  
  console.log('TitlePage: Results:', {
    kpis: kpis ? 'found' : 'null',
    themesCount: themes?.length || 0,
    responsesCount: responses?.length || 0
  });

  const getCategoryPercentage = (count: number, total: number) => 
    total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="space-y-2">
          <Breadcrumbs items={[
            { label: 'Title Analysis', href: undefined }
          ]} />
          <h1 className="text-3xl font-bold tracking-tight">
            {title}
          </h1>
          <p className="text-muted-foreground">
            Detailed analysis of NPS performance and themes for this title. Drill down into specific themes to understand what drives customer satisfaction.
          </p>
        </div>

        {/* Filters */}
        <FiltersBar surveys={surveys} titles={[]} defaultTitle={title} />

        {/* Title Performance Overview */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Performance Overview</h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.current_nps?.toFixed(1) ?? '—'}</div>
                <p className="text-xs text-muted-foreground">
                  {kpis.current_nps >= 0 ? 'Positive' : 'Negative'} NPS
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
                  Responses in period
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


        {/* Themes for this Title */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Themes for {title}</h2>
          
          {themes.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {themes.map((theme: any, i: number) => (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg capitalize">{theme.theme.replace('_', ' ')}</CardTitle>
                      <Badge variant="secondary">{theme.title_mentions} mentions</Badge>
                    </div>
                    <CardDescription>
                      {theme.title_mentions} mentions in {title} responses
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">NPS:</span>
                        <span className={`font-medium ${
                          theme.nps >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {theme.nps.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Score:</span>
                        <span className="font-medium">{theme.avg_score.toFixed(1)}/10</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Promoters:</span>
                        <span className="text-green-600">{theme.promoters}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Detractors:</span>
                        <span className="text-red-600">{theme.detractors}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Link 
                        href={`/themes/${encodeURIComponent(theme.theme)}?title=${encodeURIComponent(title)}`}
                        className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        View theme details →
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <Tag className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">No themes identified</h3>
                    <p className="text-muted-foreground mt-1">
                      No themes were found for "{title}" in the selected period.
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Try adjusting the date range</p>
                    <p>• Check if AI enrichment has been run</p>
                    <p>• Verify the title name is correct</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sample Responses */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Recent Responses</h2>
          
          {responses.length > 0 ? (
            <div className="space-y-4">
              {responses.map((response: any, i: number) => (
                <Card key={i} className="hover:shadow-sm transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-2">
                        <Badge variant={response.nps_score >= 9 ? "default" : response.nps_score >= 7 ? "secondary" : "destructive"}>
                          {response.nps_score}/10
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(response.created_at).toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed">{response.nps_explanation}</p>
                  </CardContent>
                </Card>
              ))}
              <div className="text-center pt-4">
                <Link 
                  href={`/responses?title=${encodeURIComponent(title)}`}
                  className="inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>View all responses for {title} →</span>
                </Link>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">No responses found</h3>
                    <p className="text-muted-foreground mt-1">
                      No responses with explanations found for "{title}".
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
    </div>
  );
}
