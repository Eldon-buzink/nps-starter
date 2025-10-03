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

SYSTEM = """Je bent een NPS-analist. 
Kies een primaire theme uit de gegeven lijst als er een duidelijke match is.
Als niets goed past, mag je EEN nieuw thema voorstellen (kort, concreet, NL) in 'new_theme'.
Geef 0–3 extra themas (uit de lijst OF het nieuwe thema).
Geef sentiment: promoter/passive/detractor/neutral.
Geef confidence 0..1.
Antwoord ALLEEN als JSON met de velden:
primary_theme (string),
themes (array[string], 1–4),
sentiment (string),
confidence (number 0..1),
new_theme (string, optioneel).
"""

def classify_comment(comment: str, existing_themes: List[str]) -> Dict[str, Any]:
    user_msg = (
        "Huidige themas:\n- " + "\n- ".join(existing_themes[:200]) +
        "\n\nReactie:\n" + comment
    )

    rsp = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role":"system","content": SYSTEM},
            {"role":"user","content": user_msg}
        ],
        # Ask for plain JSON object (no schema). This avoids cache/name issues.
        response_format={"type": "json_object"},
        temperature=0.1
    )

    # Robust parse
    try:
        data = json.loads(rsp.choices[0].message.content)
    except Exception:
        # Fallback: attempt to extract JSON substring if model added prose (rare)
        txt = rsp.choices[0].message.content
        start = txt.find("{")
        end   = txt.rfind("}")
        data = json.loads(txt[start:end+1]) if start != -1 and end != -1 else {}

    # Self-validate + defaults
    if not isinstance(data, dict): data = {}
    data.setdefault("primary_theme", "")
    data.setdefault("themes", [])
    data.setdefault("sentiment", "neutral")
    try:
        data["confidence"] = float(data.get("confidence", 0.6))
    except Exception:
        data["confidence"] = 0.6
    if not isinstance(data.get("themes"), list):
        data["themes"] = []
    # Optional
    if "new_theme" in data and not data["new_theme"]:
        data.pop("new_theme", None)

    return data

def upsert_enrichment(response_id, model, payload, raw):
    SB.table("nps_ai_enrichment").upsert({
        "response_id": response_id,
        "model": model,
        "themes": payload["themes"],
        "primary_theme": payload["primary_theme"],
        "sentiment": payload["sentiment"],
        "confidence": float(payload["confidence"]),
        "raw": raw
    }).execute()

def fetch_unenriched_batch(limit: int) -> List[Dict[str, Any]]:
    # Pull a candidate page (cheap) and filter out already enriched locally (idempotent)
    # Note: source table is nps_response and the text column is nps_explanation
    resp = SB.table("nps_response").select("id, nps_explanation").filter("nps_explanation", "not.is", "null").limit(limit).execute()
    rows = resp.data or []
    if not rows:
        return []
    ids = [r["id"] for r in rows]
    enriched = SB.table("nps_ai_enrichment").select("response_id").in_("response_id", ids).execute().data or []
    enriched_ids = {e["response_id"] for e in enriched}
    return [r for r in rows if r["id"] not in enriched_ids and (r["nps_explanation"] or "").strip()]

def reconcile_themes(model_out: Dict[str, Any], current_themes: List[str]) -> Dict[str, Any]:
    new_theme = (model_out.get("new_theme") or "").strip()
    primary   = (model_out.get("primary_theme") or "").strip()
    themes    = [t.strip() for t in (model_out.get("themes") or []) if t and t.strip()]

    # If new theme proposed and primary not clearly existing, create & use it
    if new_theme and (primary.lower() == new_theme.lower() or primary not in current_themes):
        canonical = ensure_theme(new_theme)
        primary = canonical
        if canonical not in themes:
            themes = [canonical] + themes

    # Canonicalize all themes (also creates if the model invented a near-duplicate)
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
    total = 0
    while True:
        batch = fetch_unenriched_batch(BATCH_SIZE)
        if not batch:
            print("✅ Klaar: geen unenriched rows meer.")
            break

        current = fetch_current_themes()

        for row in batch:
            time.sleep(PAUSE_SECS)
            txt = (row["nps_explanation"] or "").strip()
            if not txt:
                continue

            for attempt in range(5):
                try:
                    out = classify_comment(txt[:4000], current)
                    merged = reconcile_themes(out, current)
                    upsert_enrichment(row["id"], OPENAI_MODEL, merged, out)
                    total += 1
                    if total % 100 == 0:
                        print(f"Progress: {total} upserts")
                    break
                except Exception as e:
                    wait = 2 ** attempt + random.random()
                    print(f"Warn {attempt+1}/5 on {row['id']}: {e} — sleep {wait:.1f}s")
                    time.sleep(wait)
            else:
                print(f"❌ Skipped {row['id']} after retries.")

    print(f"🎉 Done. Upserts: {total}")

if __name__ == "__main__":
    main()
