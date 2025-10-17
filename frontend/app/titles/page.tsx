import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, MessageSquare, Target, AlertCircle, ArrowRight, BarChart3, UserCheck, UserX, Tag, Brain, Database, CheckCircle, Info } from "lucide-react";
import { ThemeInfoButton } from "@/components/ThemeInfoButton";
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import NPSTrendsChart from '@/components/charts/NPSTrendsChart';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Get NPS trends over time for this title
async function getTitleTrends(title: string, params: {start?:string,end?:string,survey?:string|null}) {
  try {
    let query = supabase
      .from('nps_response')
      .select('nps_score, created_at')
      .eq('title_text', title)
      .gte('created_at', params.start || '2024-01-01')
      .lte('created_at', params.end || '2025-12-31')
      .order('created_at', { ascending: true });
    
    if (params.survey) {
      query = query.eq('survey_name', params.survey);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching title trends:', error);
      return [];
    }
    
    if (!data || data.length === 0) return [];
    
    // Group by month and calculate monthly averages
    const monthlyData = new Map<string, { scores: number[], responses: number }>();
    
    data.forEach((response: any) => {
      const date = new Date(response.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { scores: [], responses: 0 });
      }
      
      const monthData = monthlyData.get(monthKey)!;
      monthData.scores.push(response.nps_score);
      monthData.responses += 1;
    });
    
    // Convert to array and calculate NPS metrics
    return Array.from(monthlyData.entries()).map(([period, data]) => {
      const avgNPS = data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length;
      const promoters = data.scores.filter(score => score >= 9).length;
      const passives = data.scores.filter(score => score >= 7 && score <= 8).length;
      const detractors = data.scores.filter(score => score <= 6).length;
      
      return {
        period,
        nps_score: avgNPS,
        responses: data.responses,
        promoters,
        passives,
        detractors
      };
    }).sort((a, b) => a.period.localeCompare(b.period));
  } catch (error) {
    console.error('Error in getTitleTrends:', error);
    return [];
  }
}

// Get themes for a specific title
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
    const themes = await Promise.all(Array.from(themeMap.values()).map(async (themeData) => {
      const avg_score = themeData.nps_scores.reduce((sum: number, score: number) => sum + score, 0) / themeData.nps_scores.length;
      
      // Determine source and business relevance based on theme name
      const isBaseTheme = ['content_kwaliteit', 'overige', 'pricing', 'delivery'].includes(themeData.theme);
      const source = isBaseTheme ? 'base' : 'ai';
      const businessRelevance = themeData.title_mentions >= 5 ? 'high' : themeData.title_mentions >= 3 ? 'medium' : 'low';
      
      // Generate explanation based on theme (enhanced with keywords)
      let explanation = '';
      if (source === 'base') {
        explanation = `Predefined business category for ${themeData.theme.replace('_', ' ')} feedback`;
      } else {
        // For AI themes, get sample keywords from actual responses
        try {
          const { data: sampleResponses } = await supabase
            .from('v_theme_assignments_normalized')
            .select(`
              nps_response!inner(nps_explanation)
            `)
            .eq('canonical_theme', themeData.theme)
            .eq('nps_response.title_text', title)
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

          explanation = `AI-discovered theme from customer feedback analysis${keywordText}. This theme emerged from multiple responses indicating ${themeData.theme.replace('_', ' ')} as a key concern.`;
        } catch (keywordError) {
          console.error('Error fetching keywords for theme:', themeData.theme, keywordError);
          explanation = `AI-discovered theme from customer feedback analysis. This theme emerged from multiple responses indicating ${themeData.theme.replace('_', ' ')} as a key concern.`;
        }
      }
      
      // Calculate sentiment (simplified)
      const avg_sentiment = avg_score >= 7 ? 0.5 : avg_score >= 5 ? 0 : -0.5;
      
      return {
        ...themeData,
        nps: themeData.title_mentions > 0 ? ((themeData.promoters - themeData.detractors) / themeData.title_mentions) * 100 : 0,
        avg_score,
        avg_sentiment,
        source,
        businessRelevance,
        explanation,
        count_responses: themeData.title_mentions,
        share_pct: 0 // Will be calculated if needed
      };
    }));

    return themes.sort((a, b) => b.title_mentions - a.title_mentions).slice(0, 10); // Top 10 themes
  } catch (error) {
    console.error('Error in getTitleThemes:', error);
    return [];
  }
}

// Get data coverage statistics for a title
async function getTitleCoverage(title: string, params: {start?:string,end?:string,survey?:string|null}) {
  try {
    // Total responses
    const { count: totalCount } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true })
      .eq('title_text', title)
      .gte('created_at', params.start || '2024-01-01')
      .lte('created_at', params.end || '2025-12-31');

    // Responses with comments
    const { count: withCommentsCount } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true })
      .eq('title_text', title)
      .gte('created_at', params.start || '2024-01-01')
      .lte('created_at', params.end || '2025-12-31')
      .not('nps_explanation', 'is', null)
      .neq('nps_explanation', '');

    // Responses with themes (enriched) - check nps_ai_enrichment table
    const { data: enrichedData, error: enrichedError } = await supabase
      .from('nps_ai_enrichment')
      .select('response_id, nps_response!inner(title_text, created_at)', { count: 'exact', head: false })
      .eq('nps_response.title_text', title)
      .gte('nps_response.created_at', params.start || '2024-01-01')
      .lte('nps_response.created_at', params.end || '2025-12-31');

    // Count unique response IDs (since one response can have multiple themes)
    const uniqueEnrichedIds = new Set(enrichedData?.map((item: any) => item.response_id) || []);
    const enrichedCount = uniqueEnrichedIds.size;

    console.log('Title Coverage for', title, ':', {
      total: totalCount || 0,
      withComments: withCommentsCount || 0,
      enriched: enrichedCount,
      percentWithComments: totalCount ? ((withCommentsCount || 0) / totalCount * 100).toFixed(1) : 0,
      percentEnriched: withCommentsCount ? (enrichedCount / (withCommentsCount || 1) * 100).toFixed(1) : 0
    });

    return {
      total: totalCount || 0,
      withComments: withCommentsCount || 0,
      enriched: enrichedCount,
      percentWithComments: totalCount ? ((withCommentsCount || 0) / totalCount * 100) : 0,
      percentEnriched: withCommentsCount ? (enrichedCount / (withCommentsCount || 1) * 100) : 0
    };
  } catch (error) {
    console.error('Error in getTitleCoverage:', error);
    return { total: 0, withComments: 0, enriched: 0, percentWithComments: 0, percentEnriched: 0 };
  }
}

// Get recent responses for a specific title
async function getTitleResponses(title: string, params: {start?:string,end?:string,survey?:string|null}) {
  try {
    const { data, error } = await supabase
      .from('nps_response')
      .select('id, nps_score, nps_explanation, created_at, title_text')
      .eq('title_text', title)
      .gte('created_at', params.start || '2024-01-01')
      .lte('created_at', params.end || '2025-12-31')
      .not('nps_explanation', 'is', null)
      .neq('nps_explanation', '')
      .order('created_at', { ascending: false })
      .limit(10);

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

// Get all titles with their NPS metrics
async function getTitles(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    let query = supabase
      .from('nps_response')
      .select('title_text, nps_score, created_at')
      .gte('created_at', params.start || '2024-01-01')
      .lte('created_at', params.end || '2025-12-31');
    
    if (params.survey) {
      query = query.eq('survey_name', params.survey);
    }
    
    if (params.title) {
      query = query.eq('title_text', params.title);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching titles:', error);
      return [];
    }
    
    // Group by title and calculate metrics
    const titleMap = new Map();
    data?.forEach((response: any) => {
      const title = response.title_text;
      if (!titleMap.has(title)) {
        titleMap.set(title, {
          title,
          total_responses: 0,
          promoters: 0,
          passives: 0,
          detractors: 0,
          nps_scores: []
        });
      }
      
      const titleData = titleMap.get(title);
      titleData.total_responses++;
      titleData.nps_scores.push(response.nps_score);
      
      if (response.nps_score >= 9) titleData.promoters++;
      else if (response.nps_score >= 7) titleData.passives++;
      else titleData.detractors++;
    });

    // Calculate NPS for each title
    const titles = Array.from(titleMap.values()).map(titleData => ({
      ...titleData,
      nps: titleData.total_responses > 0 ? ((titleData.promoters - titleData.detractors) / titleData.total_responses) * 100 : 0,
      avg_score: titleData.nps_scores.reduce((sum: number, score: number) => sum + score, 0) / titleData.nps_scores.length
    }));

    return titles.sort((a, b) => b.total_responses - a.total_responses); // Sort by response count
  } catch (error) {
    console.error('Error in getTitles:', error);
    return [];
  }
}

interface TitlesPageProps {
  searchParams: {
    start?: string;
    end?: string;
    survey?: string;
    title?: string;
  };
}

export default async function TitlesPage({ searchParams }: TitlesPageProps) {
  const { surveys } = await getFilterOptions();
  
  // Use provided dates or default to last full month
  const start = searchParams?.start ?? '2024-01-01';
  const end = searchParams?.end ?? '2025-12-31';
  const survey = searchParams?.survey ?? null;
  const title = searchParams?.title ?? null;

  console.log('TitlesPage: Fetching data with params:', { start, end, survey, title });
  
  // Fetch all titles for the filter dropdown (without title filter)
  const allTitles = await getTitles({ start, end, survey, title: null });
  
  // Fetch data for the selected title (if any)
  const selectedTitleData = title ? await getTitles({ start, end, survey, title }) : [];
  const themes = title ? await getTitleThemes(title, { start, end, survey }) : [];
  const responses = title ? await getTitleResponses(title, { start, end, survey }) : [];
  const coverage = title ? await getTitleCoverage(title, { start, end, survey }) : null;
  const trends = title ? await getTitleTrends(title, { start, end, survey }) : [];
  
  console.log('TitlesPage: Results:', {
    allTitlesCount: allTitles?.length || 0,
    selectedTitle: title,
    themesCount: themes?.length || 0,
    responsesCount: responses?.length || 0,
    coverage: coverage
  });

  const getCategoryPercentage = (count: number, total: number) => 
    total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="space-y-2">
          <Breadcrumbs items={[
            { label: 'Title Explorer', href: undefined }
          ]} />
          <h1 className="text-3xl font-bold tracking-tight">
            Title Explorer
          </h1>
          <p className="text-muted-foreground">
            Browse and analyze NPS performance across all titles. Click on any title to see detailed analysis including themes and responses.
          </p>
        </div>

        {/* Filters */}
        <FiltersBar surveys={surveys} titles={allTitles?.map(t => t.title) || []} />

        {/* Performance Overview */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Performance Overview</h2>
          
          {title && selectedTitleData.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{selectedTitleData[0].nps.toFixed(1)}</div>
                  <p className="text-xs text-muted-foreground">
                    {selectedTitleData[0].nps >= 0 ? 'Positive' : 'Negative'} NPS
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{selectedTitleData[0].total_responses}</div>
                  <p className="text-xs text-muted-foreground">
                    responses for {title}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Promoters</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{selectedTitleData[0].promoters}</div>
                  <p className="text-xs text-muted-foreground">
                    {getCategoryPercentage(selectedTitleData[0].promoters, selectedTitleData[0].total_responses)}% of responses
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Detractors</CardTitle>
                  <UserX className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{selectedTitleData[0].detractors}</div>
                  <p className="text-xs text-muted-foreground">
                    {getCategoryPercentage(selectedTitleData[0].detractors, selectedTitleData[0].total_responses)}% of responses
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-muted-foreground">--</div>
                  <p className="text-xs text-muted-foreground">
                    Select a title to view NPS
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-muted-foreground">--</div>
                  <p className="text-xs text-muted-foreground">
                    Select a title to view responses
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Promoters</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-muted-foreground">--</div>
                  <p className="text-xs text-muted-foreground">
                    Select a title to view promoters
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Detractors</CardTitle>
                  <UserX className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-muted-foreground">--</div>
                  <p className="text-xs text-muted-foreground">
                    Select a title to view detractors
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* NPS Trends Over Time */}
        {title && trends.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                NPS Trends Over Time
              </CardTitle>
              <CardDescription>
                Monthly NPS score trends for {title} showing performance evolution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NPSTrendsChart 
                data={trends} 
                title=""
                subtitle=""
              />
            </CardContent>
          </Card>
        )}

        {/* Themes Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Themes</h2>
          
          {title && themes.length > 0 ? (
            <div className="space-y-4">
              {themes.map((theme: any, i: number) => (
                <Link 
                  key={i}
                  href={`/themes/${encodeURIComponent(theme.theme)}${title ? `?title=${encodeURIComponent(title)}` : ''}`}
                  className="block border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium capitalize">
                        {theme.theme.replace(/_/g, ' ')}
                      </h4>
                      <Badge className={theme.source === 'ai' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                        {theme.source === 'ai' ? (
                          <>
                            <Brain className="h-4 w-4" />
                            <span className="ml-1">AI Generated</span>
                          </>
                        ) : (
                          <>
                            <Database className="h-4 w-4" />
                            <span className="ml-1">Base Theme</span>
                          </>
                        )}
                      </Badge>
                      <Badge className={
                        theme.businessRelevance === 'high' ? 'bg-green-100 text-green-800' :
                        theme.businessRelevance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {theme.businessRelevance === 'high' ? (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            <span className="ml-1">High Relevance</span>
                          </>
                        ) : theme.businessRelevance === 'medium' ? (
                          <>
                            <AlertCircle className="h-4 w-4" />
                            <span className="ml-1">Medium Relevance</span>
                          </>
                        ) : (
                          <>
                            <Info className="h-4 w-4" />
                            <span className="ml-1">Low Relevance</span>
                          </>
                        )}
                      </Badge>
                    </div>
                    
                    <div className="relative z-10" style={{ pointerEvents: 'auto' }}>
                      <ThemeInfoButton explanation={theme.explanation} />
                    </div>
                  </div>

                  {/* Detailed Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Volume:</span>
                      <span className="font-medium">{theme.count_responses || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg NPS:</span>
                      <span className={`font-medium ${
                        (theme.avg_score || 0) >= 7 ? 'text-green-600' : 
                        (theme.avg_score || 0) >= 6 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {(theme.avg_score || 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Promoters:</span>
                      <span className="text-green-600 font-medium">{theme.promoters}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Detractors:</span>
                      <span className="text-red-600 font-medium">{theme.detractors}</span>
                    </div>
                  </div>

                  {/* Theme Explanation */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {theme.source === 'ai' 
                        ? '🤖 This theme was discovered by AI analysis of customer feedback'
                        : '📋 This is a predefined business category'
                      }
                    </div>
                    <div className="text-sm text-blue-600 group-hover:text-blue-800 transition-colors">
                      View theme details →
                    </div>
                  </div>
                </Link>
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
                    <h3 className="text-lg font-medium text-gray-900">No title selected</h3>
                    <p className="text-muted-foreground mt-1">
                      Select a title from the filter above to view its themes and analysis.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Responses Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Recent Responses</h2>
          
          {title && responses.length > 0 ? (
            <div className="space-y-4">
              {responses.map((response: any, i: number) => (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Badge variant={response.nps_score >= 9 ? "default" : response.nps_score >= 7 ? "secondary" : "destructive"}>
                          {response.nps_score}/10
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(response.created_at).toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground italic">
                      "{response.nps_explanation}"
                    </p>
                  </CardContent>
                </Card>
              ))}
              
              {responses.length === 10 && (
                <div className="text-center py-4">
                  <Link href={`/responses?title=${encodeURIComponent(title)}`}>
                    <span className="text-sm text-black hover:text-gray-700 transition-colors">
                      View all responses for {title} →
                    </span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">No title selected</h3>
                    <p className="text-muted-foreground mt-1">
                      Select a title from the filter above to view its recent responses.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Data Coverage Info */}
        {title && coverage && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-2">Data Coverage for {title}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-amber-800 font-medium">Total Responses</p>
                      <p className="text-2xl font-bold text-amber-900">{coverage.total}</p>
                    </div>
                    <div>
                      <p className="text-amber-800 font-medium">With Comments</p>
                      <p className="text-2xl font-bold text-amber-900">{coverage.withComments}</p>
                      <p className="text-xs text-amber-700">{coverage.percentWithComments.toFixed(1)}% of total</p>
                    </div>
                    <div>
                      <p className="text-amber-800 font-medium">AI Enriched</p>
                      <p className="text-2xl font-bold text-amber-900">{coverage.enriched}</p>
                      <p className="text-xs text-amber-700">{coverage.percentEnriched.toFixed(1)}% of comments</p>
                    </div>
                    <div>
                      <p className="text-amber-800 font-medium">Theme Coverage</p>
                      <p className="text-2xl font-bold text-amber-900">
                        {coverage.total > 0 ? ((coverage.enriched / coverage.total) * 100).toFixed(1) : 0}%
                      </p>
                      <p className="text-xs text-amber-700">of all responses</p>
                    </div>
                  </div>
                  {coverage.percentEnriched < 100 && (
                    <p className="text-xs text-amber-700 mt-3">
                      ℹ️ Not all responses have been AI-enriched yet. Only responses with comments can be analyzed for themes.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

    </div>
  );
}
