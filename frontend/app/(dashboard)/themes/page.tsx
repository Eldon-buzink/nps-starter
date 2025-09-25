import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import FiltersBar from "@/components/filters/FiltersBar";
import AiExplainer from "@/components/AiExplainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getThemes(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  const { data, error } = await supabase.rpc("themes_aggregate", {
    p_start_date: params.start ?? null,
    p_end_date: params.end ?? null,
    p_survey: params.survey ?? null,
    p_title: params.title ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { theme:string; count_responses:number; share_pct:number; avg_sentiment:number; avg_nps:number }[];
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
  const start = searchParams?.start ?? null;
  const end   = searchParams?.end ?? null;
  const survey= searchParams?.survey ?? null;
  const title = searchParams?.title ?? null;

  const themeData = await getThemes({ 
    start: start ?? undefined, 
    end: end ?? undefined, 
    survey: survey ?? undefined, 
    title: title ?? undefined 
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Thema Analyse</h1>
      <p className="text-sm text-muted-foreground">Hier zie je welke onderwerpen klanten het meest noemen. Aandeel = % van alle thema-vermeldingen binnen de huidige filters.</p>

      <AiExplainer compact />
      <FiltersBar surveys={surveys} titles={titles} />
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themeData.length > 0 ? (
          themeData.map((t) => (
            <Card key={t.theme}>
              <CardHeader>
                <CardTitle className="capitalize">{t.theme.replace('_', ' ')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span><b>Volume:</b></span>
                  <span>{t.count_responses}</span>
                </div>
                <div className="flex justify-between">
                  <span><b>Aandeel:</b></span>
                  <span>{t.share_pct?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span><b>Gem. NPS:</b></span>
                  <span>{t.avg_nps?.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span><b>Sentiment:</b></span>
                  <span className={t.avg_sentiment > 0 ? 'text-green-600' : t.avg_sentiment < 0 ? 'text-red-600' : 'text-gray-600'}>
                    {t.avg_sentiment?.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">Geen thema data beschikbaar. Voer AI enrichment uit om thema's te analyseren.</p>
          </div>
        )}
      </div>
    </div>
  );
}
