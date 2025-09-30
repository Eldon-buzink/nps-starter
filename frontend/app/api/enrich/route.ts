import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CLASSIFY_SYSTEM_NL, CLASSIFY_USER_TEMPLATE_NL } from "@/lib/npsTaxonomy";
import { classifyNlStrictJSON, embed } from "@/lib/ai";
import { generateThemes, DEFAULT_CONFIG } from "@/lib/ai-theme-generation";

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
    console.log('Starting hybrid theme enrichment process...');
    
    // 1) First, discover themes from all responses (not just unenriched ones)
    console.log('Step 1: Discovering themes from all responses...');
    const { data: allResponses, error: allError } = await supabaseAdmin
      .from('nps_response')
      .select('id, nps_explanation, nps_score')
      .not('nps_explanation', 'is', null)
      .limit(1000); // Sample for theme discovery

    if (allError) {
      console.error('Error fetching responses for theme discovery:', allError);
      return NextResponse.json({ error: allError.message }, { status: 500 });
    }

    // Generate themes using hybrid approach
    const themeResult = await generateThemes(
      allResponses?.map(r => ({
        id: r.id,
        comment: r.nps_explanation || '',
        nps_score: r.nps_score || 0
      })) || [],
      DEFAULT_CONFIG
    );

    console.log(`Discovered ${themeResult.themes.length} themes:`, themeResult.themes.map(t => t.name));
    
    // 2) Now fetch unenriched rows for processing
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
      return NextResponse.json({ 
        processed, 
        skipped_no_comment, 
        failed,
        themes_discovered: themeResult.themes.length,
        theme_names: themeResult.themes.map(t => t.name)
      });
    }

    for (const r of rows) {
      try {
        if (isEmptyComment(r.nps_explanation)) { 
          skipped_no_comment++; 
          continue; 
        }

        // Use discovered themes for classification
        const availableThemes = themeResult.themes.map(t => t.name);
        const systemPrompt = CLASSIFY_SYSTEM_NL.replace(
          'content_kwaliteit, pricing, merkvertrouwen, overige',
          availableThemes.join(', ')
        );

        const user = CLASSIFY_USER_TEMPLATE_NL({
          survey_type: r.survey_name,
          nps_score: r.nps_score,
          title: r.title_text,
          comment: r.nps_explanation,
        });

        const json = await classifyNlStrictJSON(systemPrompt, user);

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

    return NextResponse.json({ 
      processed, 
      skipped_no_comment, 
      failed,
      themes_discovered: themeResult.themes.length,
      theme_names: themeResult.themes.map(t => t.name),
      theme_explanations: themeResult.themes.map(t => ({
        name: t.name,
        source: t.source,
        explanation: t.explanation,
        businessRelevance: t.businessRelevance
      }))
    });
  } catch (error) {
    console.error('Enrichment API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
