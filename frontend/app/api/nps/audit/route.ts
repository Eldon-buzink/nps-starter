import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAudit } from '@/lib/audit/rules';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get basic response data
    const { data: responses, error: responsesError } = await supabase
      .from('nps_response')
      .select('id, nps_score, nps_explanation, creation_date')
      .gte('creation_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
      return NextResponse.json({ error: 'Failed to fetch response data' }, { status: 500 });
    }

    const totalResponses = responses?.length || 0;
    const avgNpsScore = responses?.length ? 
      responses.reduce((sum, r) => sum + (r.nps_score || 0), 0) / responses.length : 0;

    // Calculate verbatim share (90 days)
    const verbatimResponses = responses?.filter(r => 
      r.nps_explanation && 
      r.nps_explanation.trim().length > 2 &&
      !r.nps_explanation.toLowerCase().includes('n.v.t.') &&
      !r.nps_explanation.toLowerCase().includes('nvt')
    ).length || 0;
    
    const verbatim90d = {
      verbatim_share: totalResponses > 0 ? verbatimResponses / totalResponses : 0,
      responses: totalResponses
    };

    // Calculate response rate (30 days) - using total responses as proxy for invites
    const responses30d = responses?.filter(r => 
      new Date(r.creation_date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length || 0;
    
    const responseRate30d = {
      response_rate: totalResponses > 0 ? responses30d / totalResponses : 0,
      responses: responses30d,
      invites: totalResponses // Using total as proxy
    };

    // Calculate survey fatigue (30 days) - using user_id if available, otherwise skip
    const { data: fatigueData, error: fatigueError } = await supabase
      .from('nps_response')
      .select('user_id')
      .gte('creation_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    let fatigue30d: Array<{ user_id: string; responses_30d: number }> = [];
    if (!fatigueError && fatigueData) {
      const userCounts = fatigueData.reduce((acc, r) => {
        if (r.user_id) {
          acc[r.user_id] = (acc[r.user_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      fatigue30d = Object.entries(userCounts).map(([user_id, responses_30d]) => ({
        user_id,
        responses_30d
      }));
    }

    // Channel mix (90 days) - using survey_name as proxy for channel
    const { data: channelData, error: channelError } = await supabase
      .from('nps_response')
      .select('survey_name')
      .gte('creation_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    let channelMix90d: Array<{ channel: string; responses: number }> = [];
    if (!channelError && channelData) {
      const channelCounts = channelData.reduce((acc, r) => {
        const channel = r.survey_name || 'unknown';
        acc[channel] = (acc[channel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      channelMix90d = Object.entries(channelCounts).map(([channel, responses]) => ({
        channel,
        responses
      }));
    }

    // NPS stability (week-over-week)
    const { data: stabilityData, error: stabilityError } = await supabase
      .from('nps_response')
      .select('nps_score, creation_date')
      .gte('creation_date', new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000).toISOString());

    let npsWoW: { wow_stddev: number; total_n: number } | undefined;
    if (!stabilityError && stabilityData && stabilityData.length > 0) {
      // Group by week and calculate average NPS per week
      const weeklyData = stabilityData.reduce((acc, r) => {
        const week = new Date(r.creation_date);
        week.setDate(week.getDate() - week.getDay()); // Start of week
        const weekKey = week.toISOString().split('T')[0];
        
        if (!acc[weekKey]) {
          acc[weekKey] = { scores: [], count: 0 };
        }
        acc[weekKey].scores.push(r.nps_score || 0);
        acc[weekKey].count++;
        return acc;
      }, {} as Record<string, { scores: number[]; count: number }>);

      const weeklyAverages = Object.values(weeklyData).map(week => 
        week.scores.reduce((sum, score) => sum + score, 0) / week.scores.length
      );

      if (weeklyAverages.length > 1) {
        const mean = weeklyAverages.reduce((sum, avg) => sum + avg, 0) / weeklyAverages.length;
        const variance = weeklyAverages.reduce((sum, avg) => sum + Math.pow(avg - mean, 2), 0) / weeklyAverages.length;
        const stddev = Math.sqrt(variance);
        
        npsWoW = {
          wow_stddev: stddev,
          total_n: stabilityData.length
        };
      }
    }

    // Check for additional data availability
    const haveEvents = false; // We don't have events table
    const haveDevices = false; // We don't have device data
    const haveLocales = false; // We don't have locale data

    // Run the audit
    const results = runAudit({
      responseRate30d,
      verbatim90d,
      fatigue30d,
      channelMix90d,
      npsWoW,
      haveEvents,
      haveDevices,
      haveLocales,
      totalResponses,
      avgNpsScore
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error running audit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
