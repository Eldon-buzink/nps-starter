import { createClient } from "@supabase/supabase-js";
import { embed } from "./ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface MonthlyTrendParams {
  start?: string; // '2025-01-01'
  end?: string;   // '2025-03-31'
  survey?: string | null;
  title?: string | null;
}

export interface MonthlyTrendResult {
  month: string;
  title: string;
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number;
}

export interface MonthlyTrendWithMoMResult {
  month: string;
  title: string;
  responses: number;
  nps: number;
  mom_delta: number | null;
}

export interface SimilarResponseResult {
  response_id: string;
  title: string;
  survey_type: string;
  created_at: string;
  nps_score: number;
  comment: string;
  similarity: number;
}

export async function getMonthlyTrendByTitle(params: MonthlyTrendParams = {}): Promise<MonthlyTrendResult[]> {
  const { data, error } = await supabase.rpc("nps_trend_by_title", {
    p_start_date: params.start ?? null,
    p_end_date: params.end ?? null,
    p_survey: params.survey ?? null,
    p_title: params.title ?? null,
  });
  
  if (error) {
    console.error('Error fetching monthly trends:', error);
    throw new Error(error.message);
  }
  
  return data as MonthlyTrendResult[];
}

export async function getMonthlyTrendWithMoM(params: MonthlyTrendParams = {}): Promise<MonthlyTrendWithMoMResult[]> {
  const { data, error } = await supabase.rpc("nps_trend_by_title_with_mom", {
    p_start_date: params.start ?? null,
    p_end_date: params.end ?? null,
    p_survey: params.survey ?? null,
    p_title: params.title ?? null,
  });
  
  if (error) {
    console.error('Error fetching monthly trends with MoM:', error);
    throw new Error(error.message);
  }
  
  return data as MonthlyTrendWithMoMResult[];
}

export async function searchSimilarByText(query: string, limit = 10): Promise<SimilarResponseResult[]> {
  try {
    // 1) Embed the query text
    const embedding = await embed(query);
    
    // 2) Call RPC with the vector
    const { data, error } = await supabase.rpc("similar_responses_by_vector", {
      p_query: embedding,
      p_limit: limit,
    });
    
    if (error) {
      console.error('Error searching similar responses:', error);
      throw new Error(error.message);
    }
    
    return data as SimilarResponseResult[];
  } catch (error) {
    console.error('Error in searchSimilarByText:', error);
    // Return empty array as fallback
    return [];
  }
}

export async function getSimilarToResponse(responseId: string, limit = 10): Promise<SimilarResponseResult[]> {
  try {
    const { data, error } = await supabase.rpc("similar_responses_for_response", {
      p_response_id: responseId,
      p_limit: limit,
    });
    
    if (error) {
      console.error('Error fetching similar responses:', error);
      throw new Error(error.message);
    }
    
    return data as SimilarResponseResult[];
  } catch (error) {
    console.error('Error in getSimilarToResponse:', error);
    // Return empty array as fallback
    return [];
  }
}
