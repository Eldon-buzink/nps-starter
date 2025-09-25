from __future__ import annotations

import csv
import io
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel
from supabase import Client, create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# -----------------------------------------------------------------------------
# Supabase
# -----------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

router = APIRouter(prefix="/ingest", tags=["ingest"])

# -----------------------------------------------------------------------------
# Columns (case-insensitive mapping)
# -----------------------------------------------------------------------------
REQUIRED_HEADERS = {"SURVEY", "NPS", "CREATIE_DT"}
OPTIONAL_HEADERS = {
    "NPS_TOELICHTING",
    "GESLACHT",
    "LEEFTIJD",
    "ABOJAREN",
    "SUBSCRIPTION_KEY",
    "TITEL_TEKST",
    "TITEL",
    "ABO_TYPE",
    "ELT_PROEF_GEHAD",
    "EXIT_OPZEGREDEN",
}
ALL_HEADERS = REQUIRED_HEADERS | OPTIONAL_HEADERS

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class IngestResult(BaseModel):
    inserted: int
    skipped: int
    raw_saved: int
    errors: List[str]

# -----------------------------------------------------------------------------
# Utilities
# -----------------------------------------------------------------------------
def normalize_headers(row: Dict[str, Any]) -> Dict[str, Any]:
    """Return a new dict with UPPERCASE headers stripped of spaces."""
    out: Dict[str, Any] = {}
    for k, v in row.items():
        if k is None:
            continue
        kk = str(k).strip().upper()
        out[kk] = v
    return out

def try_parse_date(val: Any) -> Optional[datetime.date]:
    """Parse dates like dd/mm/yyyy, d/m/yyyy, m/d/yyyy, yyyy-mm-dd, mm/dd/yyyy, excel serials."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None

    # Already a pandas/py datetime?
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.date()

    s = str(val).strip()
    if not s:
        return None

    # Excel serial date
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        try:
            return (pd.Timestamp("1899-12-30") + pd.to_timedelta(int(val), unit="D")).date()
        except Exception:
            pass

    # Try common formats
    fmts = [
        "%d/%m/%Y", "%-d/%-m/%Y",   # EU
        "%m/%d/%Y", "%-m/%-d/%Y",   # US
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d.%m.%Y",
    ]
    for f in fmts:
        try:
            return datetime.strptime(s, f).date()
        except Exception:
            continue

    # Pandas fallback
    try:
        return pd.to_datetime(s, dayfirst=True, errors="coerce").date()
    except Exception:
        return None

def to_bool_ja_nee(val: Any) -> Optional[bool]:
    if val is None:
        return None
    s = str(val).strip().lower()
    if s in {"ja", "yes", "true", "1"}:
        return True
    if s in {"nee", "no", "false", "0"}:
        return False
    return None

def clean_comment(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    low = s.lower()
    if low in {"", "n.v.t.", "nvt"}:
        return None
    return s

def nps_int(val: Any) -> Optional[int]:
    if val is None:
        return None
    try:
        n = int(float(val))
        if 0 <= n <= 10:
            return n
        return None
    except Exception:
        return None

def detect_filetype(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".xlsx"):
        return "xlsx"
    if lower.endswith(".csv"):
        return "csv"
    # Best-effort default
    return "csv"

def read_csv_bytes(file_bytes: bytes) -> List[Dict[str, Any]]:
    sample = file_bytes[:4096].decode("utf-8", errors="ignore")
    try:
        dialect = csv.Sniffer().sniff(sample)
        delimiter = dialect.delimiter
    except Exception:
        # common fallbacks
        delimiter = ";" if sample.count(";") > sample.count(",") else ","
    text = file_bytes.decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    return [dict(row) for row in reader]

def read_xlsx_bytes(file_bytes: bytes) -> List[Dict[str, Any]]:
    df = pd.read_excel(io.BytesIO(file_bytes))
    df.columns = [str(c).strip() for c in df.columns]
    return df.to_dict(orient="records")

def normalize_row(row: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Map incoming headers to our schema.
    Returns (normalized, error_message_if_any)
    """
    r = normalize_headers(row)

    # Required
    survey_type = r.get("SURVEY")
    score = nps_int(r.get("NPS"))
    created = try_parse_date(r.get("CREATIE_DT"))

    if not survey_type:
        return None, "Missing SURVEY"
    if score is None:
        return None, f"Invalid NPS: {r.get('NPS')}"
    if created is None:
        return None, f"Invalid CREATIE_DT: {r.get('CREATIE_DT')}"

    # Title can be TITEL_TEKST or TITEL
    title = r.get("TITEL_TEKST") or r.get("TITEL")
    comment = clean_comment(r.get("NPS_TOELICHTING"))

    normalized = {
        # nps_response columns
        "survey_name": str(survey_type).strip(),
        "nps_score": score,
        "nps_explanation": comment,
        "gender": (r.get("GESLACHT") or None),
        "age_range": (r.get("LEEFTIJD") or None),
        "years_employed": (r.get("ABOJAREN") or None),
        "creation_date": created.isoformat(),  # API accepts ISO date
        "title_text": (title or None),
        "nps_category": "promoter" if score >= 9 else ("passive" if score >= 7 else "detractor"),
    }
    return normalized, None

def chunked(seq: List[Dict[str, Any]], size: int) -> List[List[Dict[str, Any]]]:
    return [seq[i : i + size] for i in range(0, len(seq), size)]

# -----------------------------------------------------------------------------
# Endpoint
# -----------------------------------------------------------------------------
@router.post("", response_model=IngestResult)
async def ingest_data(file: UploadFile = File(...)) -> IngestResult:
    """
    Accept CSV/XLSX upload, parse, normalize, and batch-insert into:
      - nps_raw (original row as JSON)
      - nps_response (normalized)
    Returns counts and errors.
    """
    try:
        filename = file.filename or "upload.csv"
        filetype = detect_filetype(filename)
        raw_bytes = await file.read()

        # Read rows
        if filetype == "xlsx":
            rows = read_xlsx_bytes(raw_bytes)
        else:
            rows = read_csv_bytes(raw_bytes)

        if not rows:
            raise HTTPException(status_code=400, detail="No rows found in file")

        normalized_rows: List[Dict[str, Any]] = []
        errors: List[str] = []
        for idx, row in enumerate(rows, start=1):
            norm, err = normalize_row(row)
            if err:
                errors.append(f"Row {idx}: {err}")
                continue
            # Keep a copy of the original for nps_raw
            normalized_rows.append({"_norm": norm, "_raw": normalize_headers(row)})

        if not normalized_rows:
            return IngestResult(inserted=0, skipped=len(rows), raw_saved=0, errors=errors)

        # Batch insert
        BATCH = 500
        inserted = 0
        raw_saved = 0
        skipped = len(rows) - len(normalized_rows)

        # Insert raw first, then normalized (matching counts by order)
        for batch in chunked(normalized_rows, BATCH):
            raw_payload = []
            for r in batch:
                norm = r["_norm"]
                raw_payload.append({
                    "survey_name": norm["survey_name"],
                    "nps_score": norm["nps_score"],
                    "nps_explanation": norm["nps_explanation"],
                    "gender": norm["gender"],
                    "age_range": norm["age_range"],
                    "years_employed": norm["years_employed"],
                    "creation_date": norm["creation_date"],
                    "title_text": norm["title_text"],
                    "raw_data": r["_raw"]
                })
            resp_raw = sb.table("nps_raw").insert(raw_payload).execute()
            if not resp_raw.data:
                errors.append(f"nps_raw insert failed: {resp_raw}")
            else:
                raw_saved += len(batch)

            norm_payload = [r["_norm"] for r in batch]
            resp_norm = sb.table("nps_response").insert(norm_payload).execute()
            if not resp_norm.data:
                errors.append(f"nps_response insert failed: {resp_norm}")
            else:
                inserted += len(batch)

        # Final progress update (kept simple & clearly indented)
        result = IngestResult(
            inserted=inserted,
            skipped=skipped,
            raw_saved=raw_saved,
            errors=errors,
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest failed: {e}")