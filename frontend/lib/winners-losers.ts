import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface TopMoMMovesParams {
  start?: string; // '2025-01-01'
  end?: string;   // '2025-03-31'
  survey?: string | null;
  minResponses?: number; // default 30
  topK?: number; // default 5
}

export interface TopMoMMovesResult {
  month: string;
  title: string;
  responses: number;
  nps: number;
  mom_delta: number;
  move: 'up' | 'down';
}

export interface ThemeDriversParams {
  title: string;
  survey?: string | null;
}

export interface ThemeDriversResult {
  month: string;
  theme: string;
  count_responses: number;
  share_pct: number;
  mom_share_delta: number | null;
}

export async function getTopTitleMoMMoves(params: TopMoMMovesParams = {}): Promise<TopMoMMovesResult[]> {
  const { data, error } = await supabase.rpc("top_title_mom_moves", {
    p_start_date: params.start ?? null,
    p_end_date: params.end ?? null,
    p_survey: params.survey ?? null,
    p_min_responses: params.minResponses ?? 30,
    p_top_k: params.topK ?? 5,
  });
  
  if (error) {
    console.error('Error fetching top MoM moves:', error);
    throw new Error(error.message);
  }
  
  return data as TopMoMMovesResult[];
}

export async function getTitleThemeDrivers(params: ThemeDriversParams): Promise<ThemeDriversResult[]> {
  const { data, error } = await supabase.rpc("title_theme_share_mom", {
    p_title: params.title,
    p_survey: params.survey ?? null,
  });
  
  if (error) {
    console.error('Error fetching theme drivers:', error);
    throw new Error(error.message);
  }
  
  return data as ThemeDriversResult[];
}
