import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Get total responses
    const { count: totalResponses, error: totalError } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('Error fetching total responses:', totalError);
      return NextResponse.json({ error: 'Failed to fetch total responses' }, { status: 500 });
    }

    // Get responses with comments
    const { count: responsesWithComments, error: commentsError } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true })
      .not('nps_explanation', 'is', null)
      .neq('nps_explanation', '');

    if (commentsError) {
      console.error('Error fetching responses with comments:', commentsError);
      return NextResponse.json({ error: 'Failed to fetch responses with comments' }, { status: 500 });
    }

    // Get enriched responses by counting from nps_ai_enrichment table
    const { count: enrichedResponses, error: enrichedError } = await supabase
      .from('nps_ai_enrichment')
      .select('*', { count: 'exact', head: true });

    if (enrichedError) {
      console.error('Error fetching enriched responses:', enrichedError);
      return NextResponse.json({ error: 'Failed to fetch enriched responses' }, { status: 500 });
    }

    // Calculate percentages
    const enrichmentPercentage = responsesWithComments > 0 
      ? Math.round((enrichedResponses / responsesWithComments) * 100)
      : 0;

    // Get last enrichment run info (approximate)
    const { data: lastEnrichment, error: lastError } = await supabase
      .from('nps_ai_enrichment')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    const lastRunInfo = lastEnrichment && lastEnrichment.length > 0 
      ? {
          lastRun: lastEnrichment[0].created_at,
          // Approximate processed count (this is rough)
          processedCount: Math.min(enrichedResponses, 1000)
        }
      : null;

    return NextResponse.json({
      totalResponses: totalResponses || 0,
      responsesWithComments: responsesWithComments || 0,
      enrichedResponses: enrichedResponses || 0,
      enrichmentPercentage,
      lastRunInfo
    });

  } catch (error) {
    console.error('Error in enrichment stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
