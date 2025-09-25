import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CLASSIFY_SYSTEM_NL, CLASSIFY_USER_TEMPLATE_NL } from "@/lib/npsTaxonomy";
import { classifyNlStrictJSON, embed } from "@/lib/ai";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server only
);

function isEmptyComment(s?: string | null) {
  if (!s) return true;
  const t = s.trim().toLowerCase();
  return t === "" || t === "n.v.t." || t === "nvt";
}

export async function POST() {
  const BATCH = 100; // Process in batches of 100
  let processed = 0, skipped_no_comment = 0, failed = 0;

  try {
    console.log('Starting enrichment process...');
    
    // 1) fetch unenriched rows using a simple query
    const { data: rows, error } = await supabaseAdmin
      .from('nps_response')
      .select(`
        id,
        survey_name,
        nps_score,
        title_text,
        nps_explanation,
        nps_ai_enrichment!left(id)
      `)
      .is('nps_ai_enrichment.id', null)
      .not('nps_explanation', 'is', null)
      .limit(BATCH);

    if (error) {
      console.error('Error fetching unenriched rows:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`Found ${rows?.length || 0} unenriched rows`);
    if (rows?.length > 0) {
      console.log('Sample row:', rows[0]);
    }

    if (!rows?.length) {
      console.log('No unenriched rows found');
      return NextResponse.json({ processed, skipped_no_comment, failed });
    }

    for (const r of rows) {
      try {
        if (isEmptyComment(r.nps_explanation)) { 
          skipped_no_comment++; 
          continue; 
        }

        const user = CLASSIFY_USER_TEMPLATE_NL({
          survey_type: r.survey_name,
          nps_score: r.nps_score,
          title: r.title_text,
          comment: r.nps_explanation,
        });

        const json = await classifyNlStrictJSON(CLASSIFY_SYSTEM_NL, user);

        const promoter_flag = r.nps_score >= 9;
        const passive_flag = r.nps_score >= 7 && r.nps_score <= 8;
        const detractor_flag = r.nps_score <= 6;

        const vector = await embed(r.nps_explanation);

        const insert = await supabaseAdmin.from("nps_ai_enrichment").insert({
          response_id: r.id,
          sentiment_score: json?.sentiment ?? null,
          sentiment_label: json?.sentiment_label ?? null,
          promoter_flag, 
          passive_flag, 
          detractor_flag,
          themes: json?.themes ?? ["overige"],
          theme_scores: json?.theme_scores ?? {},
          keywords: json?.keywords ?? [],
          language: "nl",
          // Try different possible column names for the vector
          embedded_vector: vector,
        });

        if (insert.error) { 
          console.error('Error inserting enrichment:', insert.error);
          console.error('Row data:', r);
          console.error('Insert data:', {
            response_id: r.id,
            sentiment_score: json?.sentiment ?? null,
            sentiment_label: json?.sentiment_label ?? null,
            promoter_flag, 
            passive_flag, 
            detractor_flag,
            themes: json?.themes ?? ["overige"],
            theme_scores: json?.theme_scores ?? {},
            keywords: json?.keywords ?? [],
            language: "nl",
            embedding_vector: vector,
          });
          failed++; 
          continue; 
        }
        processed++;
      } catch (e) {
        console.error('Error processing row:', e);
        console.error('Row data:', r);
        failed++;
      }
    }

    return NextResponse.json({ processed, skipped_no_comment, failed });
  } catch (error) {
    console.error('Enrichment API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
