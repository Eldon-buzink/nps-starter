import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, MessageSquare, Target, AlertCircle, ArrowLeft, ThumbsUp, ThumbsDown, Lightbulb } from "lucide-react";
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Get theme-specific KPIs
async function getThemeKpis(theme: string, params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    let query = supabase
      .from('v_theme_assignments_normalized')
      .select(`
        nps_response!inner(nps_score, title_text, survey_name, creation_date)
      `)
      .eq('canonical_theme', theme)
      .gte('nps_response.creation_date', params.start || '2024-01-01')
      .lte('nps_response.creation_date', params.end || '2025-12-31');
    
    if (params.survey) {
      query = query.eq('nps_response.survey_name', params.survey);
    }
    if (params.title) {
      query = query.eq('nps_response.title_text', params.title);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching theme NPS data:', error);
      return { current_nps: 0, total_responses: 0, promoters: 0, passives: 0, detractors: 0, avg_score: 0 };
    }
    
    const total = data?.length || 0;
    const promoters = data?.filter((r: any) => r.nps_response.nps_score >= 9).length || 0;
    const passives = data?.filter((r: any) => r.nps_response.nps_score >= 7 && r.nps_response.nps_score <= 8).length || 0;
    const detractors = data?.filter((r: any) => r.nps_response.nps_score <= 6).length || 0;
    const current_nps = total > 0 ? ((promoters - detractors) / total) * 100 : 0;
    const avg_score = total > 0 ? data?.reduce((sum: number, r: any) => sum + (r.nps_response.nps_score || 0), 0) / total : 0;
    
    return { current_nps, total_responses: total, promoters, passives, detractors, avg_score };
  } catch (error) {
    console.error('Error in getThemeKpis:', error);
    return { current_nps: 0, total_responses: 0, promoters: 0, passives: 0, detractors: 0, avg_score: 0 };
  }
}

// Get titles for this theme
async function getThemeTitles(theme: string, params: {start?:string,end?:string,survey?:string|null}) {
  try {
    const { data, error } = await supabase
      .from('v_theme_assignments_normalized')
      .select(`
        nps_response!inner(title_text, nps_score, creation_date)
      `)
      .eq('canonical_theme', theme)
      .gte('nps_response.creation_date', params.start || '2024-01-01')
      .lte('nps_response.creation_date', params.end || '2025-12-31');

    if (error) {
      console.error('Error fetching theme titles:', error);
      return [];
    }

    // Group by title and calculate metrics
    const titleMap = new Map();
    data?.forEach((item: any) => {
      const title = item.nps_response.title_text;
      if (!titleMap.has(title)) {
        titleMap.set(title, {
          title,
          total: 0,
          promoters: 0,
          passives: 0,
          detractors: 0,
          nps_scores: []
        });
      }
      
      const titleData = titleMap.get(title);
      titleData.total++;
      titleData.nps_scores.push(item.nps_response.nps_score);
      
      if (item.nps_response.nps_score >= 9) titleData.promoters++;
      else if (item.nps_response.nps_score >= 7) titleData.passives++;
      else titleData.detractors++;
    });

    // Calculate NPS for each title
    const titles = Array.from(titleMap.values()).map(titleData => ({
      ...titleData,
      nps: titleData.total > 0 ? ((titleData.promoters - titleData.detractors) / titleData.total) * 100 : 0,
      avg_score: titleData.nps_scores.reduce((sum: number, score: number) => sum + score, 0) / titleData.nps_scores.length
    }));

    return titles.sort((a, b) => b.total - a.total).slice(0, 10); // Top 10 titles
  } catch (error) {
    console.error('Error in getThemeTitles:', error);
    return [];
  }
}

// Extract common meaningful words from responses (filtered for Dutch stop words)
function extractKeyInsights(responses: any[]) {
  const dutchStopWords = new Set([
    'de', 'het', 'een', 'en', 'van', 'is', 'in', 'op', 'voor', 'met', 'te', 'aan', 'zijn', 'dat',
    'die', 'deze', 'dit', 'ook', 'als', 'maar', 'bij', 'om', 'uit', 'naar', 'er', 'door', 'over',
    'hij', 'ze', 'hun', 'wordt', 'werd', 'waren', 'was', 'hebben', 'had', 'heeft', 'kan', 'moet',
    'of', 'dan', 'nog', 'wel', 'niet', 'geen', 'meer', 'veel', 'andere', 'sommige', 'alle', 'omdat',
    'ik', 'je', 'jij', 'wij', 'zij', 'mijn', 'jouw', 'zijn', 'haar', 'onze', 'jullie', 'hun',
    'zo', 'zeer', 'weer', 'al', 'dus', 'toen', 'nu', 'hier', 'daar', 'waar', 'hoe', 'wat', 'wie',
    'verleden', 'wordt'
  ]);
  
  const wordFrequency: { [key: string]: number } = {};
  
  responses.forEach(response => {
    if (!response.nps_explanation) return;
    
    // Split into words, lowercase, remove punctuation
    const words = response.nps_explanation
      .toLowerCase()
      .replace(/[.,!?;:()\[\]]/g, ' ')
      .split(/\s+/)
      .filter((word: string) => 
        word.length > 3 && // At least 4 characters
        !dutchStopWords.has(word) &&
        !/^\d+$/.test(word) // Not just numbers
      );
    
    words.forEach((word: string) => {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    });
  });
  
  // Sort by frequency and return top 10
  return Object.entries(wordFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

// Get all responses for detailed analysis (not limited to 10)
async function getAllThemeResponses(theme: string, params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    let query = supabase
      .from('v_theme_assignments_normalized')
      .select(`
        nps_response!inner(id, nps_score, nps_explanation, title_text, creation_date)
      `)
      .eq('canonical_theme', theme)
      .gte('nps_response.creation_date', params.start || '2024-01-01')
      .lte('nps_response.creation_date', params.end || '2025-12-31')
      .not('nps_response.nps_explanation', 'is', null)
      .neq('nps_response.nps_explanation', '');
    
    if (params.survey) {
      query = query.eq('nps_response.survey_name', params.survey);
    }
    if (params.title) {
      query = query.eq('nps_response.title_text', params.title);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching all theme responses:', error);
      return [];
    }
    
    return data?.map((item: any) => item.nps_response) || [];
  } catch (error) {
    console.error('Error in getAllThemeResponses:', error);
    return [];
  }
}

// Get sample responses for this theme
async function getThemeResponses(theme: string, params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    let query = supabase
      .from('v_theme_assignments_normalized')
      .select(`
        nps_response!inner(id, nps_score, nps_explanation, title_text, creation_date)
      `)
      .eq('canonical_theme', theme)
      .gte('nps_response.creation_date', params.start || '2024-01-01')
      .lte('nps_response.creation_date', params.end || '2025-12-31')
      .not('nps_response.nps_explanation', 'is', null)
      .limit(10);
    
    if (params.survey) {
      query = query.eq('nps_response.survey_name', params.survey);
    }
    if (params.title) {
      query = query.eq('nps_response.title_text', params.title);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching theme responses:', error);
      return [];
    }
    
    return data?.map((item: any) => item.nps_response) || [];
  } catch (error) {
    console.error('Error in getThemeResponses:', error);
    return [];
  }
}

interface ThemePageProps {
  params: {
    theme: string;
  };
  searchParams: {
    start?: string;
    end?: string;
    survey?: string;
    title?: string;
  };
}

export default async function ThemePage({ params, searchParams }: ThemePageProps) {
  const theme = decodeURIComponent(params.theme);
  const { surveys, titles } = await getFilterOptions();
  
  // Use provided dates or default to last full month
  const start = searchParams?.start ?? '2024-01-01';
  const end = searchParams?.end ?? '2025-12-31';
  const survey = searchParams?.survey ?? null;
  const title = searchParams?.title ?? null;

  console.log('ThemePage: Fetching data for theme:', theme, 'with params:', { start, end, survey, title });
  
  // Fetch all data in parallel
  const [kpis, responses, allResponses] = await Promise.all([
    getThemeKpis(theme, { start, end, survey, title }),
    getThemeResponses(theme, { start, end, survey, title }),
    getAllThemeResponses(theme, { start, end, survey, title })
  ]);
  
  // Extract key insights from all responses
  const keyInsights = extractKeyInsights(allResponses);
  
  // Group responses by sentiment
  const promoterResponses = allResponses.filter((r: any) => r.nps_score >= 9).slice(0, 5);
  const detractorResponses = allResponses.filter((r: any) => r.nps_score <= 6).slice(0, 5);
  
  console.log('ThemePage: Results:', {
    kpis: kpis ? 'found' : 'null',
    responsesCount: responses?.length || 0,
    allResponsesCount: allResponses?.length || 0,
    keyInsightsCount: keyInsights?.length || 0,
    promoterResponsesCount: promoterResponses?.length || 0,
    detractorResponsesCount: detractorResponses?.length || 0
  });

  const getCategoryPercentage = (count: number, total: number) => 
    total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="space-y-2">
          <Breadcrumbs items={[
            { label: 'Theme Analysis', href: undefined }
          ]} />
          <h1 className="text-3xl font-bold tracking-tight capitalize">
            {theme.replace('_', ' ')}
          </h1>
          <p className="text-muted-foreground">
            Detailed analysis of this theme across all titles. See which titles mention this theme most and drill down into specific responses.
          </p>
        </div>

        {/* Filters */}
        <FiltersBar surveys={surveys} titles={titles} />

        {/* Theme Performance Overview */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Theme Performance Overview</h2>
          
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
                <CardTitle className="text-sm font-medium">Total Mentions</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.total_responses}</div>
                <p className="text-xs text-muted-foreground">
                  Times mentioned
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
                  {getCategoryPercentage(kpis.promoters, kpis.total_responses)}% of mentions
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
                  {getCategoryPercentage(kpis.detractors, kpis.total_responses)}% of mentions
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Key Insights */}
        {keyInsights.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600" />
              <h2 className="text-xl font-semibold">Key Insights</h2>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Most Common Words & Phrases</CardTitle>
                <CardDescription>
                  These are the most frequently mentioned words in customer feedback about {theme.replace('_', ' ')}, filtered to show meaningful terms only.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {keyInsights.map((insight, i) => (
                    <Badge key={i} variant="outline" className="text-sm px-3 py-1">
                      <span className="font-medium">{insight.word}</span>
                      <span className="ml-2 text-muted-foreground">({insight.count})</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* What Promoters Say vs What Detractors Say */}
        {(promoterResponses.length > 0 || detractorResponses.length > 0) && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">What Customers Are Saying</h2>
            
            <div className="grid gap-4 md:grid-cols-2">
              {/* Promoter Feedback */}
              {promoterResponses.length > 0 && (
                <Card className="border-green-200">
                  <CardHeader className="bg-green-50">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-green-900">What Promoters Say</CardTitle>
                    </div>
                    <CardDescription>
                      Positive feedback from customers who gave 9-10 scores
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {promoterResponses.map((response: any, i: number) => (
                      <div key={i} className="border-l-4 border-green-500 pl-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-green-50">
                            {response.nps_score}/10
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {response.title_text}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          "{response.nps_explanation}"
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Detractor Feedback */}
              {detractorResponses.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader className="bg-red-50">
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="h-5 w-5 text-red-600" />
                      <CardTitle className="text-red-900">What Detractors Say</CardTitle>
                    </div>
                    <CardDescription>
                      Critical feedback from customers who gave 0-6 scores
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {detractorResponses.map((response: any, i: number) => (
                      <div key={i} className="border-l-4 border-red-500 pl-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-red-50">
                            {response.nps_score}/10
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {response.title_text}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          "{response.nps_explanation}"
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* All Responses */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Recent Responses mentioning {theme.replace('_', ' ')}</h2>
          
          {responses.length > 0 ? (
            <div className="space-y-4">
              {responses.map((response: any, i: number) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-2">
                        <Badge variant={response.nps_score >= 9 ? "default" : response.nps_score >= 7 ? "secondary" : "destructive"}>
                          {response.nps_score}/10
                        </Badge>
                        <Badge variant="outline">{response.title_text}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(response.creation_date).toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed">{response.nps_explanation}</p>
                  </CardContent>
                </Card>
              ))}
              <div className="text-center">
                <Link 
                  href={`/responses?theme=${encodeURIComponent(theme)}`}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  View all responses mentioning {theme.replace('_', ' ')} →
                </Link>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No responses found mentioning this theme.</p>
              </CardContent>
            </Card>
          )}
        </div>
    </div>
  );
}
