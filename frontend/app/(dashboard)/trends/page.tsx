import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import AiExplainer from "@/components/AiExplainer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getTrends(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    // Try RPC first
    const { data, error } = await supabase.rpc("nps_trend_by_title_with_mom", {
      p_start_date: params.start ?? null,
      p_end_date: params.end ?? null,
      p_survey: params.survey ?? null,
      p_title: params.title ?? null,
    });
    if (error) {
      console.error('RPC Error:', error);
      // Fallback to direct query
      return await getTrendsFallback(params);
    }
    return data as { month:string; title:string; responses:number; nps:number; mom_delta:number|null }[];
  } catch (error) {
    console.error('RPC failed, using fallback:', error);
    return await getTrendsFallback(params);
  }
}

async function getTrendsFallback(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  // Simple fallback - get monthly data directly
  const { data, error } = await supabase
    .from('nps_response')
    .select('creation_date, title_text, nps_score, nps_category')
    .gte('creation_date', params.start || '2024-01-01')
    .lte('creation_date', params.end || '2025-12-31')
    .not('title_text', 'is', null);
  
  if (error) throw new Error(error.message);
  
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
  const start = searchParams?.start ?? null;
  const end   = searchParams?.end ?? null;
  const survey= searchParams?.survey ?? null;
  const title = searchParams?.title ?? null;

  const rows  = await getTrends({ 
    start: start ?? undefined, 
    end: end ?? undefined, 
    survey: survey ?? undefined, 
    title: title ?? undefined 
  });

  // Group by month for a compact list + pass to a client Chart
  const chartData = rows.map(r => ({ month: r.month, nps: r.nps, responses: r.responses }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">NPS Trends</h1>
      <p className="text-sm text-muted-foreground">Maandelijkse NPS trends per merk met MoM (Month-over-Month) deltas.</p>

      <AiExplainer compact />
      <FiltersBar surveys={surveys} titles={titles} />

      {/* Chart section */}
      <div className="rounded-lg border p-4">
        {/* Replace with your chart component; show a simple fallback */}
        {chartData.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {rows.map((r,i)=>(
              <li key={`${r.month}-${i}`} className="flex items-center justify-between rounded border p-3">
                <div>
                  <div className="font-medium">{new Date(r.month).toLocaleString("nl-NL",{ month:"short", year:"numeric" })}</div>
                  <div className="text-xs text-muted-foreground">{r.responses} responses</div>
                </div>
                <div className="text-xl font-semibold">{r.nps?.toFixed(1) ?? "—"}</div>
                <div className="text-xs text-muted-foreground w-20 text-right">
                  {r.mom_delta == null ? "—" : `${r.mom_delta > 0 ? "+" : ""}${r.mom_delta.toFixed(1)} vs prev`}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">Geen data voor deze filters.</div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        MoM Delta toont de verandering t.o.v. vorige maand. Groen = verbetering, Rood = verslechtering, Grijs = geen vorige maand beschikbaar.
      </p>
    </div>
  );
}