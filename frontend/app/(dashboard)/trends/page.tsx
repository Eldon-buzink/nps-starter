import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BarChart3, LineChart } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper function to get last full calendar month
function getLastFullMonth() {
  // Use full dataset range (2024-2025)
  return {
    start: "2024-01-01",
    end: "2025-12-31"
  };
}

// Get overall trends data (with fallback)
async function getOverallTrends(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
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
    const { data, error } = await supabase
      .from('nps_response')
      .select('created_at, title_text, nps_score')
          .gte('created_at', params.start || '2025-01-01')
          .lte('created_at', params.end || '2025-12-31')
      .not('title_text', 'is', null);
    
    if (error) {
      console.error('Fallback query error:', error);
      return [];
    }
    
    // Group by month and title
    const monthlyData = new Map<string, { responses: number; promoters: number; detractors: number }>();
    
    data?.forEach(row => {
      const month = row.creation_date.substring(0, 7); // YYYY-MM
      const key = `${month}-${row.title_text}`;
      
      if (!monthlyData.has(key)) {
        monthlyData.set(key, { responses: 0, promoters: 0, detractors: 0 });
      }
      
      const data = monthlyData.get(key)!;
      data.responses++;
      if (row.nps_category === 'promoter') data.promoters++;
      if (row.nps_category === 'detractor') data.detractors++;
    });
    
    // Convert to result format
    return Array.from(monthlyData.entries()).map(([key, data]) => {
      const [month, title] = key.split('-', 2);
      const nps = ((data.promoters - data.detractors) / data.responses) * 100;
      return {
        month,
        title,
        responses: data.responses,
        nps: Math.round(nps * 10) / 10,
        mom_delta: null // No historical data for comparison
      };
    }).sort((a, b) => b.month.localeCompare(a.month));
  } catch (error) {
    console.error('Error in getOverallTrends:', error);
    return [];
  }
}

// Get trends by title
async function getTrendsByTitle(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    const { data, error } = await supabase.rpc('nps_trend_by_title_with_mom', {
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
    console.error('Error in getTrendsByTitle:', error);
    return [];
  }
}

// Get trends by survey
async function getTrendsBySurvey(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    // Get monthly data grouped by survey
    const { data, error } = await supabase
      .from('nps_response')
      .select('creation_date, survey_name, nps_score, nps_category')
      .gte('creation_date', params.start || '2024-01-01')
      .lte('creation_date', params.end || '2025-12-31')
      .not('survey_name', 'is', null);

    if (error) {
      console.error('Error fetching survey trends:', error);
      return [];
    }

    // Group by month and survey
    const monthlyData = new Map<string, { [survey: string]: { responses: number; promoters: number; detractors: number } }>();
    
    data?.forEach(row => {
      const month = row.creation_date.substring(0, 7); // YYYY-MM
      const survey = row.survey_name;
      
      if (!monthlyData.has(month)) {
        monthlyData.set(month, {});
      }
      
      const monthData = monthlyData.get(month)!;
      if (!monthData[survey]) {
        monthData[survey] = { responses: 0, promoters: 0, detractors: 0 };
      }
      
      monthData[survey].responses++;
      if (row.nps_category === 'promoter') monthData[survey].promoters++;
      if (row.nps_category === 'detractor') monthData[survey].detractors++;
    });

    // Convert to result format
    const result: any[] = [];
    monthlyData.forEach((surveys, month) => {
      Object.entries(surveys).forEach(([survey, data]) => {
        const nps = ((data.promoters - data.detractors) / data.responses) * 100;
        result.push({
          month,
          survey,
          responses: data.responses,
          nps: Math.round(nps * 10) / 10
        });
      });
    });

    return result.sort((a, b) => b.month.localeCompare(a.month));
  } catch (error) {
    console.error('Error in getTrendsBySurvey:', error);
    return [];
  }
}

// Simple chart component for overall trends
function OverallChart({ data }: { data: any[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Geen data beschikbaar voor deze periode.
      </div>
    );
  }

  // Aggregate by month for overall view
  const monthlyData = new Map<string, { responses: number; promoters: number; detractors: number }>();
  
  data.forEach(row => {
    const month = row.month;
    if (!monthlyData.has(month)) {
      monthlyData.set(month, { responses: 0, promoters: 0, detractors: 0 });
    }
    
    const monthData = monthlyData.get(month)!;
    monthData.responses += row.responses;
    monthData.promoters += Math.round((row.responses * (row.nps + 100)) / 200); // Approximate
    monthData.detractors += Math.round((row.responses * (100 - row.nps)) / 200); // Approximate
  });

  const chartData = Array.from(monthlyData.entries())
    .map(([month, data]) => ({
      month,
      nps: ((data.promoters - data.detractors) / data.responses) * 100,
      responses: data.responses
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const maxNps = Math.max(...chartData.map(d => d.nps));
  const maxResponses = Math.max(...chartData.map(d => d.responses));

  return (
    <div className="h-64 flex items-end space-x-2 p-4">
      {chartData.map((point, i) => (
        <div key={i} className="flex-1 flex flex-col items-center space-y-2">
          <div className="w-full flex flex-col items-center space-y-1">
            {/* NPS Line */}
            <div 
              className="w-1 bg-blue-500 rounded-t"
              style={{ height: `${Math.max((point.nps / maxNps) * 100, 4)}px` }}
              title={`${point.month}: NPS ${point.nps.toFixed(1)}`}
            />
            {/* Responses Bar */}
            <div 
              className="w-3 bg-gray-300 rounded-t"
              style={{ height: `${Math.max((point.responses / maxResponses) * 60, 4)}px` }}
              title={`${point.month}: ${point.responses} responses`}
            />
          </div>
          <div className="text-xs text-muted-foreground transform -rotate-45 origin-left">
            {new Date(point.month).toLocaleDateString('nl-NL', { month: 'short' })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Small multiples chart for titles
function TitleCharts({ data }: { data: any[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Geen data beschikbaar voor deze periode.
      </div>
    );
  }

  // Group by title and get top 6
  const titleData = new Map<string, any[]>();
  data.forEach(row => {
    if (!titleData.has(row.title)) {
      titleData.set(row.title, []);
    }
    titleData.get(row.title)!.push(row);
  });

  const topTitles = Array.from(titleData.entries())
    .sort((a, b) => b[1].reduce((sum, r) => sum + r.responses, 0) - a[1].reduce((sum, r) => sum + r.responses, 0))
    .slice(0, 6);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {topTitles.map(([title, points]) => {
        const maxNps = Math.max(...points.map(p => p.nps));
        const minNps = Math.min(...points.map(p => p.nps));
        const range = maxNps - minNps || 1;

        return (
          <Card key={title} className="p-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium truncate">{title}</h4>
              <div className="h-16 flex items-end space-x-1">
                {points.sort((a, b) => a.month.localeCompare(b.month)).map((point, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-blue-500 rounded-t"
                    style={{ 
                      height: `${Math.max(((point.nps - minNps) / range) * 100, 4)}%` 
                    }}
                    title={`${point.month}: ${point.nps.toFixed(1)} NPS`}
                  />
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                {points.reduce((sum, p) => sum + p.responses, 0)} responses
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// Survey trends chart
function SurveyCharts({ data }: { data: any[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Geen data beschikbaar voor deze periode.
      </div>
    );
  }

  // Group by survey
  const surveyData = new Map<string, any[]>();
  data.forEach(row => {
    if (!surveyData.has(row.survey)) {
      surveyData.set(row.survey, []);
    }
    surveyData.get(row.survey)!.push(row);
  });

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="h-64 p-4">
      <div className="space-y-4">
        {Array.from(surveyData.entries()).map(([survey, points], i) => {
          const sortedPoints = points.sort((a, b) => a.month.localeCompare(b.month));
          const maxNps = Math.max(...sortedPoints.map(p => p.nps));
          const minNps = Math.min(...sortedPoints.map(p => p.nps));
          const range = maxNps - minNps || 1;

          return (
            <div key={survey} className="flex items-center space-x-4">
              <div className="w-24 text-sm font-medium truncate">{survey}</div>
              <div className="flex-1 flex items-end space-x-1 h-8">
                {sortedPoints.map((point, j) => (
                  <div
                    key={j}
                    className="flex-1 rounded-t"
                    style={{ 
                      height: `${Math.max(((point.nps - minNps) / range) * 100, 4)}%`,
                      backgroundColor: colors[i % colors.length]
                    }}
                    title={`${point.month}: ${point.nps.toFixed(1)} NPS`}
                  />
                ))}
              </div>
              <div className="w-16 text-xs text-muted-foreground text-right">
                {sortedPoints.reduce((sum, p) => sum + p.responses, 0)} responses
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TrendsPageProps {
  searchParams: {
    start?: string;
    end?: string;
    survey?: string;
    title?: string;
  };
}

export default async function TrendsPage({ searchParams }: TrendsPageProps) {
  const { surveys, titles } = await getFilterOptions();
  
  // Use provided dates or default to last full month
  const defaultPeriod = getLastFullMonth();
  const start = searchParams?.start ?? defaultPeriod.start;
  const end = searchParams?.end ?? defaultPeriod.end;
  const survey = searchParams?.survey ?? null;
  const title = searchParams?.title ?? null;

  // Fetch all data in parallel
  const [overallTrends, titleTrends, surveyTrends] = await Promise.all([
    getOverallTrends({ start, end, survey, title }),
    getTrendsByTitle({ start, end, survey, title }),
    getTrendsBySurvey({ start, end, survey, title })
  ]);

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NPS Trends</h1>
          <p className="text-muted-foreground">
            Maandelijkse NPS trends per merk met MoM (Month-over-Month) deltas.
          </p>
          <Badge variant="outline" className="mt-2">
            MoM = verschil t.o.v. vorige maand
          </Badge>
        </div>

        <FiltersBar surveys={surveys} titles={titles} />

        <Tabs defaultValue="overall" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overall">Overall</TabsTrigger>
            <TabsTrigger value="by-title">By Title</TabsTrigger>
            <TabsTrigger value="by-survey">By Survey</TabsTrigger>
          </TabsList>

          <TabsContent value="overall" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <LineChart className="h-5 w-5" />
                  <span>Overall NPS Trends</span>
                </CardTitle>
                <CardDescription>
                  Maandelijkse NPS score en response volume
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OverallChart data={overallTrends} />
                <div className="mt-4 flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-4 bg-blue-500"></div>
                    <span>NPS Score</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-4 bg-gray-300"></div>
                    <span>Response Volume</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-title" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>NPS Trends by Title</span>
                </CardTitle>
                <CardDescription>
                  Top 6 titels by volume - small multiples
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TitleCharts data={titleTrends} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-survey" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>NPS Trends by Survey</span>
                </CardTitle>
                <CardDescription>
                  Grouped lines per survey type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SurveyCharts data={surveyTrends} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
}