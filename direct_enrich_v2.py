import os, time, json, re, random
from typing import Dict, Any, List
from openai import OpenAI
from supabase import create_client, Client

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "250"))
MAX_RPM = int(os.getenv("MAX_RPM", "180"))
PAUSE_SECS = 60.0 / MAX_RPM

SB: Client = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower().strip())
    return re.sub(r"-+", "-", s).strip("-")

def fetch_current_themes() -> List[str]:
    try:
        rows = SB.table("themes").select("name").order("name").execute().data or []
        return [r["name"] for r in rows]
    except Exception:
        # If themes table doesn't exist, return default themes
        return ["content_kwaliteit", "pricing", "merkvertrouwen", "overige"]

def ensure_theme(name: str) -> str:
    """Insert theme if missing (case-insensitive via slug); return canonical name as stored."""
    candidate = name.strip()
    if not candidate:
        return "overige"
    s = slugify(candidate)
    try:
        # Try find by slug
        existing = SB.table("themes").select("id,name,slug").eq("slug", s).limit(1).execute().data
        if existing:
            return existing[0]["name"]
        # Insert
        row = SB.table("themes").insert({"name": candidate, "slug": s}).select("name").execute().data[0]
        return row["name"]
    except Exception:
        # If themes table doesn't exist, just return the name
        return candidate

SYSTEM = """Je bent een NPS-analist. Je krijgt de huidige themalijst en een reactie.
- Kies een primaire theme uit de lijst als er een duidelijke match is.
- Als geen thema goed past, stel EEN nieuw thema voor (kort, NL, enkelvoud, product/UX-concreet).
- Geef ook 0–3 extra themas (uit de lijst OF het nieuwe thema).
- Geef sentiment: promoter/passive/detractor/neutral.
- Geef confidence 0..1.
Antwoord ALLEEN als JSON volgens het schema."""

def classify_comment(comment: str, existing_themes: List[str]) -> Dict[str, Any]:
    # Build schema for theme classification
    schema = {
        "type": "object",
        "properties": {
            "primary_theme": {"type": "string"},
            "themes": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1, "maxItems": 4
            },
            "sentiment": {"type": "string", "enum": ["promoter","passive","detractor","neutral"]},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "required": ["primary_theme","themes","sentiment","confidence"],
        "additionalProperties": False
    }

    # Give the model the CURRENT theme list and instructions
    user_msg = (
        "Huidige themas:\n- " + "\n- ".join(existing_themes[:200]) +  # guard massive lists
        "\n\nReactie:\n" + comment
    )

    rsp = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user_msg}
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "nps_schema", "schema": schema, "strict": True}
        },
        temperature=0.1,
    )
    return json.loads(rsp.choices[0].message.content)

def fetch_unenriched_batch(limit: int) -> List[Dict[str, Any]]:
    # Pull a page of responses with comments; filter out already enriched locally
    resp = SB.table("nps_response").select("id, nps_explanation").filter("nps_explanation", "not.is", "null").neq("nps_explanation", "").limit(limit).execute()
    rows = resp.data or []
    if not rows:
        return []
    
    try:
        ids = [r["id"] for r in rows]
        enriched = SB.table("nps_ai_enrichment").select("response_id").in_("response_id", ids).execute().data or []
        enriched_ids = {e["response_id"] for e in enriched}
        return [r for r in rows if r["id"] not in enriched_ids and r["nps_explanation"]]
    except Exception:
        # If enrichment table doesn't exist, return all rows
        return [r for r in rows if r["nps_explanation"]]

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
    except Exception as e:
        print(f"Warning: Could not upsert enrichment for {response_id}: {e}")
        # For now, just print the result instead of storing
        print(f"Would store: {payload}")

def reconcile_themes(model_out: Dict[str, Any], current_themes: List[str]) -> Dict[str, Any]:
    primary = model_out.get("primary_theme", "").strip()
    themes = [t.strip() for t in model_out.get("themes", []) if t and t.strip()]

    # For any theme not in current list, ensure and canonicalize
    canon_themes = []
    seen = set()
    for t in themes:
        canon = ensure_theme(t)
        if canon not in seen:
            seen.add(canon)
            canon_themes.append(canon)

    return {
        "primary_theme": primary if primary else (canon_themes[0] if canon_themes else ensure_theme("overige")),
        "themes": canon_themes if canon_themes else [ensure_theme("overige")],
        "sentiment": model_out["sentiment"],
        "confidence": float(model_out["confidence"]),
    }

def main():
    total = 0
    while True:
        batch = fetch_unenriched_batch(BATCH_SIZE)
        if not batch:
            print("✅ Geen unenriched rows meer.")
            break

        # fetch themes once per batch (cheap), we'll still ensure() when needed
        current = fetch_current_themes()

        for row in batch:
            time.sleep(PAUSE_SECS)
            comment = row["nps_explanation"].strip()
            if not comment:
                continue

            for attempt in range(5):
                try:
                    out = classify_comment(comment[:4000], current)
                    merged = reconcile_themes(out, current)
                    upsert_enrichment(row["id"], OPENAI_MODEL, merged, out)
                    total += 1
                    if total % 100 == 0:
                        print(f"Progress: {total}")
                    break
                except Exception as e:
                    wait = 2 ** attempt + random.random()
                    print(f"Warn {attempt+1}/5 on {row['id']}: {e}; sleep {wait:.1f}s")
                    time.sleep(wait)
            else:
                print(f"❌ Skipped {row['id']} after retries.")

    print(f"🎉 Upserts: {total}")

if __name__ == "__main__":
    main()
