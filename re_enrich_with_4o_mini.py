import os, time, json, re, random, sys
from typing import Dict, Any, List, Optional
from supabase import create_client, Client
from openai import OpenAI

# ---- Config (env) ----
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
BATCH_SIZE   = int(os.getenv("BATCH_SIZE", "100"))  # Smaller batches for re-enrichment
MAX_RPM      = int(os.getenv("MAX_RPM", "60"))      # Conservative rate limit
PAUSE_SECS   = 60.0 / max(1, MAX_RPM)
MAX_EMPTY_BATCHES = 3
MAX_RETRIES  = 5

SB: Client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

def log(*args):
    print(*args, flush=True)

def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower().strip())
    return re.sub(r"-+", "-", s).strip("-")

def fetch_current_themes() -> List[str]:
    try:
        rows = SB.table("themes").select("name").order("name").execute().data or []
        return [r["name"] for r in rows]
    except Exception:
        return ["content_kwaliteit", "pricing", "merkvertrouwen", "overige"]

def ensure_theme(name: str) -> str:
    candidate = (name or "").strip() or "overige"
    try:
        s = slugify(candidate)
        found = SB.table("themes").select("name").eq("slug", s).limit(1).execute().data
        if found:
            return found[0]["name"]
        ins = SB.table("themes").insert({"name": candidate, "slug": s}).select("name").execute().data
        if ins and len(ins):
            return ins[0]["name"]
        again = SB.table("themes").select("name").eq("slug", s).limit(1).execute().data
        return again[0]["name"] if again else candidate
    except Exception:
        return candidate

SYSTEM = """Je bent een NPS-analist.
- Kies een primaire theme uit de gegeven lijst wanneer passend.
- Als niets goed past, stel ÉÉN nieuw thema voor in 'new_theme' (kort, concreet, NL).
- Geef 0–3 extra themas (uit de lijst of het nieuwe thema).
- Geef sentiment: promoter/passive/detractor/neutral.
- Geef confidence 0..1.
Antwoord ALLEEN als JSON met velden:
primary_theme (string), themes (array[string] 1–4), sentiment (string), confidence (0..1), new_theme (optional string)."""

def classify_comment(comment: str, existing_themes: List[str]) -> Dict[str, Any]:
    user_msg = "Huidige themas:\n- " + "\n- ".join(existing_themes[:200]) + "\n\nReactie:\n" + comment
    rsp = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role":"system","content": SYSTEM}, {"role":"user","content": user_msg}],
        response_format={"type":"json_object"},
        temperature=0.1
    )
    txt = rsp.choices[0].message.content
    try:
        data = json.loads(txt)
    except Exception:
        i, j = txt.find("{"), txt.rfind("}")
        data = json.loads(txt[i:j+1]) if i != -1 and j != -1 else {}
    if not isinstance(data, dict): data = {}
    data.setdefault("primary_theme", "")
    data.setdefault("themes", [])
    data.setdefault("sentiment", "neutral")
    try:
        data["confidence"] = float(data.get("confidence", 0.6))
    except Exception:
        data["confidence"] = 0.6
    if "new_theme" in data and not (data["new_theme"] or "").strip():
        data.pop("new_theme", None)
    if not isinstance(data.get("themes"), list):
        data["themes"] = []
    return data

def reconcile_themes(model_out: Dict[str, Any], current_themes: List[str]) -> Dict[str, Any]:
    new_theme = (model_out.get("new_theme") or "").strip()
    primary   = (model_out.get("primary_theme") or "").strip()
    themes    = [t.strip() for t in (model_out.get("themes") or []) if t and t.strip()]

    if new_theme and (primary.lower() == new_theme.lower() or primary not in current_themes):
        canonical = ensure_theme(new_theme)
        primary = canonical
        if canonical not in themes:
            themes = [canonical] + themes

    canon_themes: List[str] = []
    seen = set()
    for t in themes:
        c = ensure_theme(t)
        if c not in seen:
            seen.add(c); canon_themes.append(c)

    if not primary:
        primary = canon_themes[0] if canon_themes else ensure_theme("overige")
    if not canon_themes:
        canon_themes = [ensure_theme("overige")]

    return {
        "primary_theme": primary,
        "themes": canon_themes,
        "sentiment": model_out["sentiment"],
        "confidence": float(model_out["confidence"]),
    }

def fetch_all_enriched_responses(limit: int, offset: int) -> List[Dict[str, Any]]:
    """Fetch all responses that have comments and are already enriched"""
    res = SB.table('nps_response')\
        .select('id, nps_explanation')\
        .filter('nps_explanation', 'not.is', 'null')\
        .range(offset, offset + limit - 1)\
        .execute()
    return res.data or []

def upsert_enrichment_rpc(rid: str, model: str, payload: Dict[str,Any], raw: Dict[str,Any]):
    SB.rpc("upsert_nps_ai_enrichment_if_exists", {
      "p_response_id": rid,
      "p_model": model,
      "p_themes": payload["themes"],
      "p_primary_theme": payload["primary_theme"],
      "p_sentiment": payload["sentiment"],
      "p_confidence": float(payload["confidence"]),
      "p_raw": raw
    }).execute()

def main():
    log("🔄 Re-enriching all responses with gpt-4o-mini")
    log("SUPABASE_URL:", os.environ.get("SUPABASE_URL"))
    log("SR KEY last6:", os.environ.get("SUPABASE_SERVICE_ROLE_KEY","")[-6:])
    log("Model:", OPENAI_MODEL, "Batch:", BATCH_SIZE, "MaxRPM:", MAX_RPM)

    # Get total count of responses with comments
    total_responses = SB.table('nps_response')\
        .select('id', count='exact')\
        .filter('nps_explanation', 'not.is', 'null')\
        .execute()
    
    total_count = total_responses.count
    log(f"📊 Total responses to re-enrich: {total_count}")

    total_processed = 0
    offset = 0
    current = fetch_current_themes()

    while offset < total_count:
        batch = fetch_all_enriched_responses(BATCH_SIZE, offset)
        if not batch:
            log("No more responses to process")
            break

        log(f"Processing batch {offset//BATCH_SIZE + 1}: {len(batch)} responses (offset {offset}/{total_count})")

        for row in batch:
            txt = (row.get("nps_explanation") or "").strip()
            if not txt:
                continue
                
            time.sleep(PAUSE_SECS)

            for attempt in range(MAX_RETRIES):
                try:
                    out = classify_comment(txt[:4000], current)
                    merged = reconcile_themes(out, current)
                    upsert_enrichment_rpc(row["id"], OPENAI_MODEL, merged, out)
                    total_processed += 1
                    
                    if total_processed % 50 == 0:
                        log(f"✅ Progress: {total_processed}/{total_count} re-enriched ({total_processed/total_count*100:.1f}%)")
                    
                    break
                except Exception as e:
                    wait = min(32, 2 ** attempt) + random.random()
                    log(f"⚠️  Attempt {attempt+1}/{MAX_RETRIES} on {row['id']}: {e} — sleep {wait:.1f}s")
                    time.sleep(wait)
            else:
                log(f"❌ Skipped {row['id']} after retries.")

        offset += len(batch)

    log(f"🎉 Re-enrichment complete! Processed: {total_processed}/{total_count} responses")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Interrupted by user.")
        sys.exit(1)
