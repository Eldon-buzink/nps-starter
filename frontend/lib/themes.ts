import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ThemesAggregateParams {
  start?: string; // '2025-01-01'
  end?: string;   // '2025-03-31'
  survey?: string | null;
  title?: string | null;
  npsBucket?: "promoter" | "passive" | "detractor" | null;
}

export interface ThemesAggregateResult {
  theme: string;
  count_responses: number;
  share_pct: number;
  avg_sentiment: number | null;
  avg_nps: number | null;
}

export interface PromoterDetractorResult {
  theme: string;
  promoters: number;
  detractors: number;
}

export async function getThemesAggregate(params: ThemesAggregateParams = {}): Promise<ThemesAggregateResult[]> {
  const { data, error } = await supabase.rpc("themes_aggregate", {
    p_start_date: params.start ?? null,
    p_end_date: params.end ?? null,
    p_survey: params.survey ?? null,
    p_title: params.title ?? null,
    p_nps_bucket: params.npsBucket ?? null,
  });
  
  if (error) {
    console.error('Error fetching themes aggregate:', error);
    throw new Error(error.message);
  }
  
  return data as ThemesAggregateResult[];
}

export async function getThemesPromoterDetractor(params: Omit<ThemesAggregateParams, 'npsBucket'> = {}): Promise<PromoterDetractorResult[]> {
  const { data, error } = await supabase.rpc("themes_promoter_detractor", {
    p_start_date: params.start ?? null,
    p_end_date: params.end ?? null,
    p_survey: params.survey ?? null,
    p_title: params.title ?? null,
  });
  
  if (error) {
    console.error('Error fetching promoter/detractor themes:', error);
    throw new Error(error.message);
  }
  
  return data as PromoterDetractorResult[];
}
