import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, MessageSquare, Target, AlertCircle } from "lucide-react";
import { Navigation } from "@/components/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getKpis(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  const { data, error } = await supabase
    .from('nps_response')
    .select('nps_score, nps_category, creation_date, survey_name, title_text')
    .gte('creation_date', params.start || '2024-01-01')
    .lte('creation_date', params.end || '2025-12-31')
    .not('title_text', 'is', null);
  
  if (error) throw new Error(error.message);
  
  const total = data?.length || 0;
  const promoters = data?.filter(r => r.nps_category === 'promoter').length || 0;
  const passives = data?.filter(r => r.nps_category === 'passive').length || 0;
  const detractors = data?.filter(r => r.nps_category === 'detractor').length || 0;
  
  const nps = total > 0 ? ((promoters - detractors) / total) * 100 : 0;
  const avgScore = total > 0 ? data?.reduce((sum, r) => sum + r.nps_score, 0) / total : 0;
  
  return {
    total,
    nps: Math.round(nps * 10) / 10,
    avgScore: Math.round(avgScore * 10) / 10,
    promoters,
    passives,
    detractors,
    promoterPct: total > 0 ? Math.round((promoters / total) * 100) : 0,
    passivePct: total > 0 ? Math.round((passives / total) * 100) : 0,
    detractorPct: total > 0 ? Math.round((detractors / total) * 100) : 0
  };
}

async function getMovers(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  // Get current and previous month data
  const currentMonth = new Date().toISOString().substring(0, 7);
  const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().substring(0, 7);
  
  const [currentData, lastData] = await Promise.all([
    supabase.from('nps_response')
      .select('title_text, nps_category, nps_score')
      .gte('creation_date', `${currentMonth}-01`)
      .lt('creation_date', `${new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().substring(0, 7)}-01`),
    supabase.from('nps_response')
      .select('title_text, nps_category, nps_score')
      .gte('creation_date', `${lastMonth}-01`)
      .lt('creation_date', `${currentMonth}-01`)
  ]);
  
  // Calculate NPS for each title
  const calculateNPS = (data: any[]) => {
    const titleMap = new Map<string, { promoters: number, detractors: number, total: number }>();
    
    data.forEach(row => {
      if (!row.title_text) return;
      
      if (!titleMap.has(row.title_text)) {
        titleMap.set(row.title_text, { promoters: 0, detractors: 0, total: 0 });
      }
      
      const titleData = titleMap.get(row.title_text)!;
      titleData.total++;
      
      if (row.nps_category === 'promoter') titleData.promoters++;
      else if (row.nps_category === 'detractor') titleData.detractors++;
    });
    
    const result = new Map<string, number>();
    titleMap.forEach((data, title) => {
      if (data.total >= 30) { // Minimum responses
        result.set(title, ((data.promoters - data.detractors) / data.total) * 100);
      }
    });
    
    return result;
  };
  
  const currentNPS = calculateNPS(currentData.data || []);
  const lastNPS = calculateNPS(lastData.data || []);
  
  // Calculate changes
  const changes: Array<{title: string, current: number, previous: number, delta: number, responses: number}> = [];
  
  currentNPS.forEach((currentScore, title) => {
    const lastScore = lastNPS.get(title) || 0;
    const delta = currentScore - lastScore;
    const responses = currentData.data?.filter(r => r.title_text === title).length || 0;
    
    if (Math.abs(delta) > 0.1) { // Significant change
      changes.push({
        title,
        current: Math.round(currentScore * 10) / 10,
        previous: Math.round(lastScore * 10) / 10,
        delta: Math.round(delta * 10) / 10,
        responses
      });
    }
  });
  
  // Sort by absolute change
  changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  
  return {
    winners: changes.filter(c => c.delta > 0).slice(0, 3),
    losers: changes.filter(c => c.delta < 0).slice(0, 3)
  };
}

async function getTopThemes(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  const { data, error } = await supabase
    .from('nps_ai_enrichment')
    .select('themes, sentiment_score, response_id, nps_response!inner(nps_score, nps_category, creation_date, survey_name, title_text, nps_explanation)')
    .gte('nps_response.creation_date', params.start || '2024-01-01')
    .lte('nps_response.creation_date', params.end || '2025-12-31')
    .not('themes', 'is', null);
  
  if (error || !data) {
    return { promoters: [], detractors: [] };
  }
  
  // Process themes by category
  const promoterThemes = new Map<string, { count: number, quotes: string[] }>();
  const detractorThemes = new Map<string, { count: number, quotes: string[] }>();
  
  data.forEach(row => {
    const themes = row.themes as string[];
    const category = row.nps_response?.nps_category;
    const comment = row.nps_response?.nps_explanation || '';
    
    themes.forEach(theme => {
      if (category === 'promoter') {
        if (!promoterThemes.has(theme)) {
          promoterThemes.set(theme, { count: 0, quotes: [] });
        }
        const data = promoterThemes.get(theme)!;
        data.count++;
        if (comment && data.quotes.length < 2) {
          data.quotes.push(comment);
        }
      } else if (category === 'detractor') {
        if (!detractorThemes.has(theme)) {
          detractorThemes.set(theme, { count: 0, quotes: [] });
        }
        const data = detractorThemes.get(theme)!;
        data.count++;
        if (comment && data.quotes.length < 2) {
          data.quotes.push(comment);
        }
      }
    });
  });
  
  // Get top 3 for each category
  const promoters = Array.from(promoterThemes.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([theme, data]) => ({ theme, count: data.count, quotes: data.quotes }));
    
  const detractors = Array.from(detractorThemes.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([theme, data]) => ({ theme, count: data.count, quotes: data.quotes }));
  
  return { promoters, detractors };
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
  const start = searchParams?.start ?? null;
  const end = searchParams?.end ?? null;
  const survey = searchParams?.survey ?? null;
  const title = searchParams?.title ?? null;

  const [kpis, movers, themes] = await Promise.all([
    getKpis({ start: start ?? undefined, end: end ?? undefined, survey: survey ?? undefined, title: title ?? undefined }),
    getMovers({ start: start ?? undefined, end: end ?? undefined, survey: survey ?? undefined, title: title ?? undefined }),
    getTopThemes({ start: start ?? undefined, end: end ?? undefined, survey: survey ?? undefined, title: title ?? undefined })
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
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
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.nps}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.total} responses
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
              {kpis.promoterPct}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passives</CardTitle>
            <Users className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.passives}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.passivePct}% of total
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
              {kpis.detractorPct}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Movers */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
              Grootste NPS-stijgers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {movers.winners.length > 0 ? (
              <div className="space-y-3">
                {movers.winners.map((mover, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{mover.title}</p>
                      <p className="text-sm text-muted-foreground">{mover.responses} responses</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">+{mover.delta}</p>
                      <p className="text-sm text-muted-foreground">{mover.current} NPS</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Geen significante stijgers deze periode.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingDown className="h-5 w-5 mr-2 text-red-600" />
              Grootste NPS-dalers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {movers.losers.length > 0 ? (
              <div className="space-y-3">
                {movers.losers.map((mover, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{mover.title}</p>
                      <p className="text-sm text-muted-foreground">{mover.responses} responses</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">{mover.delta}</p>
                      <p className="text-sm text-muted-foreground">{mover.current} NPS</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Geen significante dalers deze periode.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Themes */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
              Top Promoter Themes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {themes.promoters.length > 0 ? (
              <div className="space-y-4">
                {themes.promoters.map((theme, i) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="capitalize">
                        {theme.theme.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{theme.count} mentions</span>
                    </div>
                    {theme.quotes.length > 0 && (
                      <p className="text-sm text-muted-foreground italic">
                        "{theme.quotes[0].substring(0, 100)}..."
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Geen promoter thema's beschikbaar.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingDown className="h-5 w-5 mr-2 text-red-600" />
              Top Detractor Themes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {themes.detractors.length > 0 ? (
              <div className="space-y-4">
                {themes.detractors.map((theme, i) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="destructive" className="capitalize">
                        {theme.theme.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{theme.count} mentions</span>
                    </div>
                    {theme.quotes.length > 0 && (
                      <p className="text-sm text-muted-foreground italic">
                        "{theme.quotes[0].substring(0, 100)}..."
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Geen detractor thema's beschikbaar.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Data Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            In deze periode: {kpis.total} reacties • Data van CREATIE_DT
          </p>
        </CardContent>
      </Card>
        </div>
      </main>
    </div>
  );
}