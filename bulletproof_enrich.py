import os, time, json, re, random
from typing import Dict, Any, List
from openai import OpenAI
from supabase import create_client, Client

# ---- Config ----
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
BATCH_SIZE   = int(os.getenv("BATCH_SIZE", "250"))
MAX_RPM      = int(os.getenv("MAX_RPM", "180"))
PAUSE_SECS   = 60.0 / MAX_RPM

SB: Client = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

# ---- Helpers ----
def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower().strip())
    return re.sub(r"-+", "-", s).strip("-")

def fetch_current_themes() -> List[str]:
    try:
        res = SB.table("themes").select("name").order("name").execute()
        rows = res.data or []
        return [r["name"] for r in rows]
    except Exception:
        # If themes table doesn't exist or no permission, use default themes
        return ["content_kwaliteit", "pricing", "merkvertrouwen", "overige"]

def ensure_theme(name: str) -> str:
    candidate = (name or "").strip()
    if not candidate:
        candidate = "overige"
    try:
        s = slugify(candidate)
        found = SB.table("themes").select("name,slug").eq("slug", s).limit(1).execute().data
        if found:
            return found[0]["name"]
        ins = SB.table("themes").insert({"name": candidate, "slug": s}).select("name").execute()
        if ins.data and len(ins.data):
            return ins.data[0]["name"]
        # race: try read again
        again = SB.table("themes").select("name").eq("slug", s).limit(1).execute().data
        if again:
            return again[0]["name"]
        return candidate
    except Exception:
        # If themes table doesn't exist or no permission, just return the name
        return candidate

def classify_comment(comment: str, existing_themes: List[str]) -> Dict[str, Any]:
    """Simple classification using plain text - no structured outputs"""
    
    prompt = f"""Classify this Dutch NPS response:

Huidige themas: {', '.join(existing_themes[:20])}

Reactie: "{comment}"

Respond with exactly this format (no other text):
THEME: [choose from existing themes or suggest new one]
SENTIMENT: [promoter/passive/detractor/neutral]  
CONFIDENCE: [0.0-1.0]

Example:
THEME: content_kwaliteit
SENTIMENT: promoter
CONFIDENCE: 0.8"""

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
            temperature=0.1
        )
        
        text = response.choices[0].message.content.strip()
        
        # Parse the simple format
        theme_match = re.search(r"THEME:\s*(.+)", text)
        sentiment_match = re.search(r"SENTIMENT:\s*(\w+)", text)
        confidence_match = re.search(r"CONFIDENCE:\s*([\d.]+)", text)
        
        theme = theme_match.group(1).strip() if theme_match else "overige"
        sentiment = sentiment_match.group(1).strip() if sentiment_match else "neutral"
        confidence = float(confidence_match.group(1)) if confidence_match else 0.5
        
        return {
            "primary_theme": theme,
            "themes": [theme],
            "sentiment": sentiment,
            "confidence": confidence
        }
        
    except Exception as e:
        print(f"Error classifying: {e}")
        return {
            "primary_theme": "overige",
            "themes": ["overige"],
            "sentiment": "neutral",
            "confidence": 0.0
        }

def upsert_enrichment(response_id, model, payload, raw):
    try:
        SB.table("nps_ai_enrichment").upsert({
            "response_id": response_id,
            "model": model,
            "themes": payload["themes"],
            "primary_theme": payload["primary_theme"],
            "sentiment": payload["sentiment"],
            "confidence": float(payload["confidence"]),
            "raw": raw
        }).execute()
        return True
    except Exception as e:
        print(f"Warning: Could not store enrichment for {response_id}: {e}")
        return False

def fetch_unenriched_batch(limit: int) -> List[Dict[str, Any]]:
    try:
        resp = SB.table("nps_response").select("id, nps_explanation").filter("nps_explanation", "not.is", "null").limit(limit).execute()
        rows = resp.data or []
        if not rows:
            return []
        
        ids = [r["id"] for r in rows]
        enriched = SB.table("nps_ai_enrichment").select("response_id").in_("response_id", ids).execute().data or []
        enriched_ids = {e["response_id"] for e in enriched}
        return [r for r in rows if r["id"] not in enriched_ids and (r["nps_explanation"] or "").strip()]
    except Exception as e:
        print(f"Error fetching responses: {e}")
        return []

def reconcile_themes(model_out: Dict[str, Any], current_themes: List[str]) -> Dict[str, Any]:
    primary = (model_out.get("primary_theme") or "").strip()
    themes = [t.strip() for t in (model_out.get("themes") or []) if t and t.strip()]

    # Canonicalize all themes
    canon_themes: List[str] = []
    seen = set()
    for t in themes:
        can = ensure_theme(t)
        if can not in seen:
            seen.add(can)
            canon_themes.append(can)

    # Fallbacks
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

def main():
    print("🚀 Starting bulletproof enrichment (no structured outputs)...")
    total = 0
    
    while True:
        batch = fetch_unenriched_batch(BATCH_SIZE)
        if not batch:
            print("✅ Klaar: geen unenriched rows meer.")
            break

        current = fetch_current_themes()
        print(f"📦 Processing {len(batch)} responses...")

        for row in batch:
            time.sleep(PAUSE_SECS)
            txt = (row["nps_explanation"] or "").strip()
            if not txt:
                continue

            for attempt in range(3):  # Fewer retries since it's simpler
                try:
                    out = classify_comment(txt[:4000], current)
                    merged = reconcile_themes(out, current)
                    
                    if upsert_enrichment(row["id"], OPENAI_MODEL, merged, out):
                        total += 1
                        if total % 10 == 0:
                            print(f"Progress: {total} upserts")
                    break
                except Exception as e:
                    wait = 2 ** attempt + random.random()
                    print(f"Warn {attempt+1}/3 on {row['id']}: {e} — sleep {wait:.1f}s")
                    time.sleep(wait)
            else:
                print(f"❌ Skipped {row['id']} after retries.")

    print(f"🎉 Done. Upserts: {total}")

if __name__ == "__main__":
    main()
