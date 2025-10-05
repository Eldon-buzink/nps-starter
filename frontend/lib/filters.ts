import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getFilterOptions() {
  const [s1, s2] = await Promise.all([
    supabase.from("v_filter_surveys").select("survey_name"),
    supabase.from("v_filter_titles").select("title_text"),
  ]);
  const surveys = (s1.data ?? []).map(d => d.survey_name);
  const titles = (s2.data ?? []).map(d => d.title_text);
  return { surveys, titles };
}
