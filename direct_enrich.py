import os, time, json, re, random, sys
from typing import Dict, Any, List, Optional
from supabase import create_client, Client
from openai import OpenAI

# ---- Config (env) ----
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
BATCH_SIZE   = int(os.getenv("BATCH_SIZE", "300"))  # 200–500 typical
MAX_RPM      = int(os.getenv("MAX_RPM", "180"))     # requests per minute
PAUSE_SECS   = 60.0 / max(1, MAX_RPM)
MAX_EMPTY_BATCHES = 3                               # hard stop (prevents infinite loop)
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
        # If themes table doesn't exist or no permission, use default themes
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
        # If themes table doesn't exist or no permission, just return the name
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
        response_format={"type":"json_object"},  # no schema cache issues
        temperature=0.1
    )
    txt = rsp.choices[0].message.content
    # Robust JSON parse
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

def fetch_unenriched_batch(limit: int, after: Optional[str]) -> List[Dict[str, Any]]:
    params = {"p_limit": limit}
    if after: params["p_after"] = after
    res = SB.rpc("get_unenriched_batch", params).execute()
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
    log("SUPABASE_URL:", os.environ.get("SUPABASE_URL"))
    log("SR KEY last6:", os.environ.get("SUPABASE_SERVICE_ROLE_KEY","")[-6:])
    log("Model:", OPENAI_MODEL, "Batch:", BATCH_SIZE, "MaxRPM:", MAX_RPM)

    total, empty_streak, cursor = 0, 0, None

    while True:
        batch = fetch_unenriched_batch(BATCH_SIZE, cursor)
        if not batch:
            empty_streak += 1
            log(f"No rows in batch (streak {empty_streak}/{MAX_EMPTY_BATCHES}).")
            if empty_streak >= MAX_EMPTY_BATCHES:
                break  # <<< prevents infinite loop
            time.sleep(2)
            continue

        empty_streak = 0
        cursor = batch[-1]["id"]  # keyset pagination

        current = fetch_current_themes()

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
                    total += 1
                    if total % 100 == 0:
                        log(f"Progress: {total} upserts…")
                    break
                except Exception as e:
                    wait = min(32, 2 ** attempt) + random.random()
                    log(f"Warn attempt {attempt+1}/{MAX_RETRIES} on {row['id']}: {e} — sleep {wait:.1f}s")
                    time.sleep(wait)
            else:
                log(f"❌ Skipped {row['id']} after retries.")

    log(f"🎉 Done. Upserts total: {total}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Interrupted by user.")
        sys.exit(1)

# End of file