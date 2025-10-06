import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, TrendingUp, TrendingDown, Lightbulb, Brain, Database, CheckCircle, AlertCircle, Info } from "lucide-react";
import Link from "next/link";
import OtherClusterDetails from "@/components/OtherClusterDetails";
import { ThemeInfoButton } from "@/components/ThemeInfoButton";

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

// Get themes data from normalized view with enhanced explanations
async function getThemes(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    
    // Use the normalized view that handles synonyms and "Other (cluster)" collapsing
    const { data, error } = await supabase
      .from('v_theme_overview_normalized')
      .select('*')
      .order('mentions', { ascending: false });
    
    
    if (error) {
      console.error('Normalized themes query error:', error);
      return [];
    }
    
    // Transform the data to match the expected format and add enhanced explanations
    const result = await Promise.all(data?.map(async (row) => {
      // Define the original base themes (the ones that were predefined)
      const baseThemes = ['content_kwaliteit', 'pricing', 'merkvertrouwen', 'overige'];
      const isBaseTheme = baseThemes.includes(row.theme);
      const isOtherCluster = row.theme === 'Other (cluster)';
      
      // Determine business relevance based on mentions
      let businessRelevance: 'high' | 'medium' | 'low' = 'medium';
      if (row.mentions >= 100) businessRelevance = 'high';
      else if (row.mentions < 10) businessRelevance = 'low';

      let explanation = '';
      
      if (isOtherCluster) {
        explanation = 'Cluster of themes with fewer than 3 mentions each';
      } else if (isBaseTheme) {
        explanation = `Predefined business category for ${row.theme.replace('_', ' ')} feedback`;
      } else {
        // For AI themes, get sample keywords from actual responses
        try {
          const { data: sampleResponses } = await supabase
            .from('v_theme_assignments_normalized')
            .select(`
              nps_response!inner(nps_explanation)
            `)
            .eq('canonical_theme', row.theme)
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

          explanation = `AI-discovered theme from customer feedback analysis${keywordText}. This theme emerged from multiple responses indicating ${row.theme.replace('_', ' ')} as a key concern.`;
        } catch (keywordError) {
          console.error('Error fetching keywords for theme:', row.theme, keywordError);
          explanation = `AI-discovered theme from customer feedback analysis. This theme emerged from multiple responses indicating ${row.theme.replace('_', ' ')} as a key concern.`;
        }
      }

      return {
        theme: row.theme,
        count_responses: row.mentions,
        share_pct: row.mentions > 0 ? Math.round((row.mentions / (data.reduce((sum, r) => sum + r.mentions, 0))) * 100 * 10) / 10 : 0,
        avg_sentiment: Math.round((row.avg_sentiment || 0) * 100) / 100,
        avg_nps: Math.round((row.avg_nps || 0) * 10) / 10,
        pct_promoters: Math.round((row.pct_promoters || 0) * 100),
        pct_passives: Math.round((row.pct_passives || 0) * 100),
        pct_detractors: Math.round((row.pct_detractors || 0) * 100),
        pct_pos_sentiment: Math.round((row.pct_pos_sentiment || 0) * 100),
        pct_neg_sentiment: Math.round((row.pct_neg_sentiment || 0) * 100),
        // Add enhanced explanation data
        explanation,
        source: isBaseTheme ? 'base' as const : 'ai' as const,
        businessRelevance,
        frequency: row.mentions / (data.reduce((sum, t) => sum + t.mentions, 0) || 1),
        confidence: isBaseTheme ? 1.0 : 0.8
      };
    }) || []);
    
    console.log(`Processed ${result.length} normalized themes with explanations:`, result.slice(0, 5));
    return result;
  } catch (error) {
    console.error('Error in getThemes:', error);
    return [];
  }
}

// Get promoters vs detractors data from normalized themes
async function getPromoterDetractorData(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    console.log('Getting promoter/detractor data from normalized themes');
    
    // Use the normalized view data that already includes promoter/detractor percentages
    const { data, error } = await supabase
      .from('v_theme_overview_normalized')
      .select('*')
      .order('mentions', { ascending: false });
    
    if (error) {
      console.error('Normalized promoter/detractor query error:', error);
      return [];
    }
    
    console.log(`Found ${data?.length || 0} normalized themes for promoter/detractor analysis`);
    
    // Transform the data to include actual counts
    const result = data?.map(row => ({
      theme: row.theme,
      promoters: Math.round((row.pct_promoters || 0) * row.mentions),
      detractors: Math.round((row.pct_detractors || 0) * row.mentions),
      total_responses: row.mentions
    })) || [];
    
    console.log(`Processed ${result.length} normalized themes for promoter/detractor analysis:`, result.slice(0, 5));
    return result;
  } catch (error) {
    console.error('Error in getPromoterDetractorData:', error);
    return [];
  }
}

// Get top 5 themes for sparklines
async function getTopThemesForSparklines(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    const themes = await getThemes(params);
    const top5Themes = themes.slice(0, 5);
    
    // For each theme, get monthly share data using normalized themes
    const sparklineData = await Promise.all(
      top5Themes.map(async (theme: any) => {
        // Get theme assignments for this normalized theme
        const { data: themeData, error: themeError } = await supabase
          .from('v_theme_assignments_normalized')
          .select(`
            canonical_theme,
            response_id,
            nps_response!inner(creation_date)
          `)
          .eq('canonical_theme', theme.theme)
          .gte('nps_response.creation_date', '2024-01-01')
          .lte('nps_response.creation_date', '2025-12-31');
        
        if (themeError) {
          console.error('Error fetching theme data:', themeError);
          return { theme: theme.theme, data: [] };
        }
        
        console.log(`Theme data for ${theme.theme}:`, { count: themeData?.length, data: themeData?.slice(0, 3) });
        
        // Group theme data by month (count unique responses, not theme assignments)
        const monthlyThemeData = themeData?.reduce((acc: any, row: any) => {
          const month = new Date(row.nps_response.creation_date).toISOString().substring(0, 7);
          if (!acc[month]) {
            acc[month] = new Set();
          }
          acc[month].add(row.response_id);
          return acc;
        }, {}) || {};
        
        // Convert sets to counts
        const monthlyThemeCounts = Object.keys(monthlyThemeData).reduce((acc: any, month: string) => {
          acc[month] = monthlyThemeData[month].size;
          return acc;
        }, {});
        
        // Calculate total responses across all themes for each month
        // This gives us a more accurate total for percentage calculation
        const { data: allThemeData, error: allThemeError } = await supabase
          .from('v_theme_assignments_normalized')
          .select(`
            response_id,
            nps_response!inner(creation_date)
          `)
          .gte('nps_response.creation_date', '2024-01-01')
          .lte('nps_response.creation_date', '2025-12-31');
        
        if (allThemeError) {
          console.error('Error fetching all theme data:', allThemeError);
          return { theme: theme.theme, data: [] };
        }
        
        // Group all theme data by month (unique responses across all themes)
        const monthlyTotalData = allThemeData?.reduce((acc: any, row: any) => {
          const month = new Date(row.nps_response.creation_date).toISOString().substring(0, 7);
          if (!acc[month]) {
            acc[month] = new Set();
          }
          acc[month].add(row.response_id);
          return acc;
        }, {}) || {};
        
        // Convert sets to counts
        const monthlyTotalCounts = Object.keys(monthlyTotalData).reduce((acc: any, month: string) => {
          acc[month] = monthlyTotalData[month].size;
          return acc;
        }, {});
        
        // Calculate share percentages and create sparkline points
        const sparklinePoints = Object.keys(monthlyTotalCounts).map(month => {
          const themeCount = monthlyThemeCounts[month] || 0;
          const totalCount = monthlyTotalCounts[month] || 0;
          const sharePct = totalCount > 0 ? (themeCount / totalCount) * 100 : 0;
          
          return {
            month,
            share_pct: sharePct
          };
        }).sort((a, b) => a.month.localeCompare(b.month));
        
        console.log(`Sparkline data for ${theme.theme}:`, {
          monthlyThemeCounts,
          monthlyTotalCounts,
          sparklinePoints
        });
        
        return {
          theme: theme.theme,
          data: sparklinePoints
        };
      })
    );
    
    return sparklineData;
  } catch (error) {
    console.error('Error in getTopThemesForSparklines:', error);
    return [];
  }
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
  
  // Use provided dates or default to 2024 (your actual data period)
  const start = searchParams?.start ?? '2024-01-01';
  const end = searchParams?.end ?? '2025-12-31';
  const survey = searchParams?.survey ?? null;
  const title = searchParams?.title ?? null;

  console.log('ThemesPage: Fetching data with params:', { start, end, survey, title });
  
  // Fetch all data in parallel
  const [themes, promoterDetractorData, sparklineData] = await Promise.all([
    getThemes({ start, end, survey, title }),
    getPromoterDetractorData({ start, end, survey, title }),
    getTopThemesForSparklines({ start, end, survey, title })
  ]);
  
  console.log('ThemesPage: Results:', {
    themesCount: themes.length,
    promoterDetractorCount: promoterDetractorData.length,
    sparklineDataCount: sparklineData.length
  });

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thema Analyse</h1>
          <p className="text-muted-foreground">
            Hier zie je welke onderwerpen klanten het meest noemen. Aandeel = % van alle thema-vermeldingen binnen de huidige filters.
          </p>
        </div>

        <FiltersBar surveys={surveys} titles={titles} />

        {/* Trends per Theme (Top 5 Sparklines) */}
        {sparklineData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Trends per Thema (Top 5)</CardTitle>
              <CardDescription>
                Maandelijkse aandeel ontwikkeling van de top 5 thema's
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {sparklineData.map((themeData: any, i: number) => {
                  const avgPercentage = themeData.data.length > 0 
                    ? (themeData.data.reduce((sum: number, point: any) => sum + point.share_pct, 0) / themeData.data.length)
                    : 0;
                  
                  const isTrendingUp = themeData.data.length > 1 && 
                    themeData.data[themeData.data.length - 1]?.share_pct > themeData.data[themeData.data.length - 2]?.share_pct;
                  
                  return (
                    <div key={i} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h4 className="font-medium text-lg capitalize">{themeData.theme.replace('_', ' ')}</h4>
                          <p className="text-sm text-muted-foreground">Monthly trend</p>
                        </div>
                        <div className="text-right">
                      <div className="flex items-center space-x-2">
                        {themeData.data.length > 1 && (
                              isTrendingUp ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                              )
                            )}
                            <span className="text-2xl font-bold">
                              {avgPercentage.toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">Average share</p>
                        </div>
                      </div>
                      
                      <div className="flex items-end space-x-1 h-12 bg-gray-50 rounded p-2">
                        {themeData.data.map((point: any, j: number) => {
                          const maxHeight = Math.max(...themeData.data.map((p: any) => p.share_pct || 0));
                          const height = maxHeight > 0 ? ((point.share_pct || 0) / maxHeight) * 100 : 0;
                          
                          return (
                        <div
                          key={j}
                              className="bg-blue-500 rounded-t flex-1 min-w-[4px]"
                          style={{
                                height: `${Math.max(height, 8)}%`,
                          }}
                          title={`${point.month}: ${point.share_pct?.toFixed(1)}%`}
                        />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Theme Discovery Summary */}
        {themes.length > 0 && (
          <Card className="w-full">
                <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Theme Discovery & Explanations
                  </CardTitle>
              <p className="text-sm text-muted-foreground">
                Understanding how themes are generated and their business relevance
              </p>
                </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {themes.filter(t => t.source === 'base').length}
                  </div>
                  <div className="text-sm text-gray-600">Base Themes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {themes.filter(t => t.source === 'ai').length}
                  </div>
                  <div className="text-sm text-gray-600">AI Discovered</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {themes.filter(t => t.businessRelevance === 'high').length}
                  </div>
                  <div className="text-sm text-gray-600">High Relevance</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{themes.length}</div>
                  <div className="text-sm text-gray-600">Total Themes</div>
                </div>
              </div>

              {/* Theme List with Tags and Detailed Data */}
              <div className="space-y-3">
                {themes.map((theme, index) => {
                  // Use the theme data directly since it now includes all the explanation data
                  
                  return (
                    <Link
                      key={theme.theme}
                      href={`/themes/${encodeURIComponent(theme.theme)}`}
                      className="block border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
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
                        
                        <ThemeInfoButton explanation={theme.explanation} />
                      </div>

                      {/* Detailed Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Volume:</span>
                          <span className="font-medium">{theme.count_responses || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Share:</span>
                          <span className="font-medium">{theme.share_pct?.toFixed(1) || 0}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Avg NPS:</span>
                          <span className={`font-medium ${
                            (theme.avg_nps || 0) >= 7 ? 'text-green-600' : 
                            (theme.avg_nps || 0) >= 6 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {(theme.avg_nps || 0).toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Sentiment:</span>
                          <span className={`font-medium ${
                            (theme.avg_sentiment || 0) > 0 ? 'text-green-600' : 
                            (theme.avg_sentiment || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {(theme.avg_sentiment || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Theme Explanation */}
                      <div className="mt-3 text-xs text-muted-foreground">
                        {theme.source === 'ai' 
                          ? '🤖 This theme was discovered by AI analysis of customer feedback'
                          : '📋 This is a predefined business category'
                        }
                      </div>
                    </Link>
                  );
                })}
                  </div>
                </CardContent>
              </Card>
          )}


        {/* Promoters vs Detractors Chart */}
        {promoterDetractorData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Promoters vs Detractors per Thema</CardTitle>
              <CardDescription>
                Verdeel van NPS-categorieën per thema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {promoterDetractorData.slice(0, 10).map((item: any, i: number) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize font-medium">{item.theme.replace('_', ' ')}</span>
                      <span>{item.total_responses} responses</span>
                    </div>
                    <div className="flex h-6 bg-gray-200 rounded overflow-hidden">
                      <div 
                        className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(item.promoters / item.total_responses) * 100}%` }}
                      >
                        {item.promoters > 0 && `${Math.round((item.promoters / item.total_responses) * 100)}%`}
                      </div>
                      <div 
                        className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(item.detractors / item.total_responses) * 100}%` }}
                      >
                        {item.detractors > 0 && `${Math.round((item.detractors / item.total_responses) * 100)}%`}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Promoters: {item.promoters}</span>
                      <span>Detractors: {item.detractors}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Click on themes above to see detailed analysis */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Need More Details?</h3>
                <p className="text-sm text-blue-800">
                  Click on any theme above to see detailed insights including:
                </p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                  <li>Common words and phrases from customer feedback</li>
                  <li>What promoters say vs what detractors say</li>
                  <li>Specific examples and quotes</li>
                  <li>Filtered responses for the selected title</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Empty State */}
        {themes.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">Geen thema's in deze periode.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Voer AI enrichment uit om thema's te analyseren.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}