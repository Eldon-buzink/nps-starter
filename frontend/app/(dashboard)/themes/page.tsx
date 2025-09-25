import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

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

// Get themes data from themes_aggregate
async function getThemes(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    const { data, error } = await supabase.rpc('themes_aggregate', {
      p_start_date: params.start ?? null,
      p_end_date: params.end ?? null,
      p_survey: params.survey ?? null,
      p_title: params.title ?? null,
    });
    if (error) {
      console.error('RPC Error:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getThemes:', error);
    return [];
  }
}

// Get promoters vs detractors data
async function getPromoterDetractorData(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    const { data, error } = await supabase.rpc('themes_promoter_detractor', {
      p_start_date: params.start ?? null,
      p_end_date: params.end ?? null,
      p_survey: params.survey ?? null,
      p_title: params.title ?? null,
    });
    if (error) {
      console.error('RPC Error:', error);
      return [];
    }
    return data || [];
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
    
    // For each theme, get monthly share data
    const sparklineData = await Promise.all(
      top5Themes.map(async (theme: any) => {
        const { data, error } = await supabase.rpc('title_theme_share_mom', {
          p_theme: theme.theme,
          p_start_date: params.start ?? null,
          p_end_date: params.end ?? null,
          p_survey: params.survey ?? null,
          p_title: params.title ?? null,
        });
        
        return {
          theme: theme.theme,
          data: data || []
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
  
  // Use provided dates or default to last full month
  const defaultPeriod = getLastFullMonth();
  const start = searchParams?.start ?? defaultPeriod.start;
  const end = searchParams?.end ?? defaultPeriod.end;
  const survey = searchParams?.survey ?? null;
  const title = searchParams?.title ?? null;

  // Fetch all data in parallel
  const [themes, promoterDetractorData, sparklineData] = await Promise.all([
    getThemes({ start, end, survey, title }),
    getPromoterDetractorData({ start, end, survey, title }),
    getTopThemesForSparklines({ start, end, survey, title })
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thema Analyse</h1>
          <p className="text-muted-foreground">
            Hier zie je welke onderwerpen klanten het meest noemen. Aandeel = % van alle thema-vermeldingen binnen de huidige filters.
          </p>
        </div>

        <FiltersBar surveys={surveys} titles={titles} />

        {/* Theme Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {themes.length > 0 ? (
            themes.map((theme: any) => (
              <Card key={theme.theme} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="capitalize">{theme.theme.replace('_', ' ')}</span>
                    <Link href={`/responses?theme=${encodeURIComponent(theme.theme)}`}>
                      <Button variant="ghost" size="sm">
                        <Tag className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Volume:</span>
                    <span className="text-sm">{theme.count_responses}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Aandeel:</span>
                    <Badge variant="secondary">{theme.share_pct?.toFixed(1)}%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Gem. NPS:</span>
                    <span className={`text-sm font-medium ${
                      theme.avg_nps >= 7 ? 'text-green-600' : 
                      theme.avg_nps >= 6 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {theme.avg_nps?.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Sentiment:</span>
                    <span className={`text-sm font-medium ${
                      theme.avg_sentiment > 0 ? 'text-green-600' : 
                      theme.avg_sentiment < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {theme.avg_sentiment?.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-8">
              <p className="text-muted-foreground">Geen thema's in deze periode.</p>
            </div>
          )}
        </div>

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
              <div className="space-y-4">
                {sparklineData.map((themeData: any, i: number) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="capitalize font-medium">{themeData.theme.replace('_', ' ')}</span>
                      <div className="flex items-center space-x-2">
                        {themeData.data.length > 1 && (
                          <>
                            {themeData.data[themeData.data.length - 1]?.share_pct > themeData.data[themeData.data.length - 2]?.share_pct ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                            <span className="text-sm text-muted-foreground">
                              {themeData.data[themeData.data.length - 1]?.share_pct?.toFixed(1)}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-end space-x-1 h-8">
                      {themeData.data.map((point: any, j: number) => (
                        <div
                          key={j}
                          className="bg-blue-500 rounded-t"
                          style={{
                            height: `${Math.max((point.share_pct || 0) * 2, 4)}px`,
                            width: '8px'
                          }}
                          title={`${point.month}: ${point.share_pct?.toFixed(1)}%`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
    </div>
  );
}