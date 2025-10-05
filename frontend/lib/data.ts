import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface NpsSummary {
  total_responses: number;
  nps_score: number;
  promoters: number;
  passives: number;
  detractors: number;
  avg_score: number;
}

export interface MonthlyTrend {
  month: string;
  nps_score: number;
  total_responses: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export interface SurveyData {
  survey_name: string;
  nps_score: number;
  total_responses: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export interface TitleData {
  title_text: string;
  nps_score: number;
  total_responses: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export interface RecentResponse {
  id: string;
  nps_score: number;
  nps_explanation: string;
  survey_name: string;
  title_text: string;
  created_at: string;
}

export interface MomMove {
  title_text: string;
  current_nps: number;
  previous_nps: number;
  mom_delta: number;
  current_responses: number;
  previous_responses: number;
}

// Get NPS summary data
export async function getNpsSummary(): Promise<NpsSummary | null> {
  try {
    // Get total count
    const { count: total_responses, error: countError } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error fetching total count:', countError);
      return null;
    }

    // Get promoters count (NPS score 9-10)
    const { count: promoters, error: promotersError } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true })
      .gte('nps_score', 9);
    
    if (promotersError) {
      console.error('Error fetching promoters count:', promotersError);
      return null;
    }

    // Get passives count (NPS score 7-8)
    const { count: passives, error: passivesError } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true })
      .gte('nps_score', 7)
      .lte('nps_score', 8);
    
    if (passivesError) {
      console.error('Error fetching passives count:', passivesError);
      return null;
    }

    // Get detractors count (NPS score 0-6)
    const { count: detractors, error: detractorsError } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true })
      .lte('nps_score', 6);
    
    if (detractorsError) {
      console.error('Error fetching detractors count:', detractorsError);
      return null;
    }

    // Get average score
    const { data: avgData, error: avgError } = await supabase
      .from('nps_response')
      .select('nps_score')
      .limit(1000); // Sample for performance
    
    if (avgError) {
      console.error('Error fetching average score:', avgError);
      return null;
    }

    const avg_score = avgData ? avgData.reduce((sum, row) => sum + row.nps_score, 0) / avgData.length : 0;
    
    // Calculate NPS score
    const nps_score = (total_responses || 0) > 0 ? (((promoters || 0) - (detractors || 0)) / (total_responses || 1)) * 100 : 0;
    
    return {
      total_responses: total_responses || 0,
      nps_score: Math.round(nps_score * 10) / 10, // Round to 1 decimal
      promoters: promoters || 0,
      passives: passives || 0,
      detractors: detractors || 0,
      avg_score: Math.round(avg_score * 10) / 10
    };
  } catch (error) {
    console.error('Error in getNpsSummary:', error);
    return null;
  }
}

// Get monthly NPS trends
export async function getMonthlyTrends(
  startDate?: string,
  endDate?: string
): Promise<MonthlyTrend[]> {
  try {
    let query = supabase
      .from('nps_response')
      .select('creation_date, nps_category, nps_score')
      .order('creation_date', { ascending: true });

    if (startDate) {
      query = query.gte('creation_date', startDate);
    }
    if (endDate) {
      query = query.lte('creation_date', endDate);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching monthly trends:', error);
      return [];
    }
    
    if (!data) return [];

    // Group by month and calculate metrics
    const monthlyData = new Map<string, {
      promoters: number;
      passives: number;
      detractors: number;
      total: number;
    }>();

    data.forEach(row => {
      const month = new Date(row.creation_date).toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { promoters: 0, passives: 0, detractors: 0, total: 0 });
      }
      const monthData = monthlyData.get(month)!;
      monthData.total++;
      if (row.nps_category === 'promoter') monthData.promoters++;
      else if (row.nps_category === 'passive') monthData.passives++;
      else if (row.nps_category === 'detractor') monthData.detractors++;
    });

    // Convert to array and calculate NPS scores
    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      nps_score: data.total > 0 ? ((data.promoters - data.detractors) / data.total) * 100 : 0,
      total_responses: data.total,
      promoters: data.promoters,
      passives: data.passives,
      detractors: data.detractors
    }));
  } catch (error) {
    console.error('Error in getMonthlyTrends:', error);
    return [];
  }
}

// Get NPS by survey
export async function getNpsBySurvey(): Promise<SurveyData[]> {
  try {
    const { data, error } = await supabase
      .from('nps_response')
      .select('survey_name, nps_category, nps_score');
    
    if (error) {
      console.error('Error fetching NPS by survey:', error);
      return [];
    }
    
    if (!data) return [];

    // Group by survey and calculate metrics
    const surveyData = new Map<string, {
      promoters: number;
      passives: number;
      detractors: number;
      total: number;
    }>();

    data.forEach(row => {
      const survey = row.survey_name;
      if (!surveyData.has(survey)) {
        surveyData.set(survey, { promoters: 0, passives: 0, detractors: 0, total: 0 });
      }
      const surveyInfo = surveyData.get(survey)!;
      surveyInfo.total++;
      if (row.nps_category === 'promoter') surveyInfo.promoters++;
      else if (row.nps_category === 'passive') surveyInfo.passives++;
      else if (row.nps_category === 'detractor') surveyInfo.detractors++;
    });

    // Convert to array and calculate NPS scores
    return Array.from(surveyData.entries()).map(([survey_name, data]) => ({
      survey_name,
      nps_score: data.total > 0 ? ((data.promoters - data.detractors) / data.total) * 100 : 0,
      total_responses: data.total,
      promoters: data.promoters,
      passives: data.passives,
      detractors: data.detractors
    })).sort((a, b) => b.nps_score - a.nps_score);
  } catch (error) {
    console.error('Error in getNpsBySurvey:', error);
    return [];
  }
}

// Get NPS by title
export async function getNpsByTitle(): Promise<TitleData[]> {
  try {
    const { data, error } = await supabase
      .from('nps_response')
      .select('title_text, nps_category, nps_score')
      .not('title_text', 'is', null);
    
    if (error) {
      console.error('Error fetching NPS by title:', error);
      return [];
    }
    
    if (!data) return [];

    // Group by title and calculate metrics
    const titleData = new Map<string, {
      promoters: number;
      passives: number;
      detractors: number;
      total: number;
    }>();

    data.forEach(row => {
      const title = row.title_text || 'Unknown';
      if (!titleData.has(title)) {
        titleData.set(title, { promoters: 0, passives: 0, detractors: 0, total: 0 });
      }
      const titleInfo = titleData.get(title)!;
      titleInfo.total++;
      if (row.nps_category === 'promoter') titleInfo.promoters++;
      else if (row.nps_category === 'passive') titleInfo.passives++;
      else if (row.nps_category === 'detractor') titleInfo.detractors++;
    });

    // Convert to array and calculate NPS scores, filter titles with at least 10 responses
    return Array.from(titleData.entries())
      .filter(([_, data]) => data.total >= 10)
      .map(([title_text, data]) => ({
        title_text,
        nps_score: data.total > 0 ? ((data.promoters - data.detractors) / data.total) * 100 : 0,
        total_responses: data.total,
        promoters: data.promoters,
        passives: data.passives,
        detractors: data.detractors
      }))
      .sort((a, b) => b.nps_score - a.nps_score);
  } catch (error) {
    console.error('Error in getNpsByTitle:', error);
    return [];
  }
}

// Get recent responses
export async function getRecentResponses(limit: number = 10): Promise<RecentResponse[]> {
  try {
    const { data, error } = await supabase
      .from('nps_response')
      .select('id, nps_score, nps_explanation, survey_name, title_text, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching recent responses:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getRecentResponses:', error);
    return [];
  }
}

// Get month-over-month moves
