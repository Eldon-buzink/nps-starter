"""
Enhanced data ingestion endpoint for NPS data
Handles CSV/XLSX files with robust parsing and normalization
"""

import pandas as pd
import io
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import re

router = APIRouter(prefix="/ingest", tags=["ingestion"])

class IngestResponse(BaseModel):
    inserted: int
    skipped: int
    errors: int
    error_details: List[str] = []

def normalize_headers(headers: List[str]) -> Dict[str, str]:
    """Normalize headers case-insensitively and map to standard names"""
    header_mapping = {
        'survey': 'survey_type',
        'nps': 'nps_score', 
        'nps_toelichting': 'comment',
        'geslacht': 'gender',
        'leeftijd': 'age_band',
        'abojaren': 'tenure',
        'creatie_dt': 'created_at',
        'subscription_key': 'subscription_key',
        'titel_tekst': 'title',
        'titel': 'title',
        'abo_type': 'subscription_type',
        'elt_proef_gehad': 'had_trial',
        'exit_opzegreden': 'exit_reason'
    }
    
    normalized = {}
    for header in headers:
        # Clean and normalize header
        clean_header = header.strip().lower().replace(' ', '_')
        if clean_header in header_mapping:
            normalized[header] = header_mapping[clean_header]
        else:
            normalized[header] = clean_header
    
    return normalized

def parse_date(date_str: str) -> Optional[str]:
    """Parse various date formats and return ISO date string"""
    if not date_str or pd.isna(date_str):
        return None
    
    date_str = str(date_str).strip()
    if not date_str:
        return None
    
    # Common date formats to try
    date_formats = [
        '%d/%m/%Y',    # dd/mm/yyyy
        '%d/%m/%y',    # dd/mm/yy
        '%d-%m-%Y',    # dd-mm-yyyy
        '%d-%m-%y',    # dd-mm-yy
        '%m/%d/%Y',    # mm/dd/yyyy
        '%m/%d/%y',    # mm/dd/yy
        '%Y-%m-%d',    # yyyy-mm-dd
        '%d.%m.%Y',    # dd.mm.yyyy
        '%d.%m.%y',    # dd.mm.yy
    ]
    
    for fmt in date_formats:
        try:
            parsed_date = datetime.strptime(date_str, fmt)
            return parsed_date.strftime('%Y-%m-%d')
        except ValueError:
            continue
    
    return None

def normalize_comment(comment: str) -> Optional[str]:
    """Normalize comment field, treating empty values as None"""
    if not comment or pd.isna(comment):
        return None
    
    comment = str(comment).strip()
    if comment.lower() in ['', 'n.v.t.', 'nvt', 'n/a', 'na', 'none']:
        return None
    
    return comment

def detect_file_type(filename: str, content: bytes) -> str:
    """Detect file type by filename and magic bytes"""
    filename_lower = filename.lower()
    
    if filename_lower.endswith('.xlsx'):
        return 'xlsx'
    elif filename_lower.endswith('.xls'):
        return 'xls'
    elif filename_lower.endswith('.csv'):
        return 'csv'
    
    # Check magic bytes
    if content.startswith(b'PK\x03\x04'):
        return 'xlsx'
    elif content.startswith(b'\xd0\xcf\x11\xe0'):
        return 'xls'
    else:
        # Assume CSV if we can't determine
        return 'csv'

def parse_csv_content(content: bytes, delimiter: str = None) -> pd.DataFrame:
    """Parse CSV content with automatic delimiter detection"""
    # Try to detect delimiter
    if delimiter is None:
        sample = content[:1024].decode('utf-8', errors='ignore')
        sniffer = pd.io.common.Sniffer()
        try:
            delimiter = sniffer.sniff(sample).delimiter
        except:
            delimiter = ','
    
    # Try different encodings
    encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
    df = None
    
    for encoding in encodings:
        try:
            df = pd.read_csv(
                io.StringIO(content.decode(encoding)),
                delimiter=delimiter,
                dtype=str,  # Read all as strings initially
                na_filter=False  # Don't convert to NaN
            )
            break
        except UnicodeDecodeError:
            continue
    
    if df is None:
        raise ValueError("Could not decode file with any supported encoding")
    
    return df

def parse_excel_content(content: bytes) -> pd.DataFrame:
    """Parse Excel content"""
    try:
        df = pd.read_excel(io.BytesIO(content), dtype=str, na_filter=False)
        return df
    except Exception as e:
        raise ValueError(f"Could not parse Excel file: {str(e)}")

def normalize_row(row: pd.Series, header_mapping: Dict[str, str]) -> Dict[str, Any]:
    """Normalize a single row of data"""
    normalized = {}
    
    for original_header, value in row.items():
        if original_header in header_mapping:
            standard_name = header_mapping[original_header]
            
            # Handle different field types
            if standard_name == 'nps_score':
                try:
                    normalized[standard_name] = int(float(str(value))) if str(value).strip() else None
                except (ValueError, TypeError):
                    normalized[standard_name] = None
            elif standard_name == 'created_at':
                normalized[standard_name] = parse_date(str(value))
            elif standard_name == 'comment':
                normalized[standard_name] = normalize_comment(str(value))
            elif standard_name in ['had_trial', 'subscription_key']:
                # Boolean or key fields
                val = str(value).strip().lower()
                if val in ['true', '1', 'yes', 'ja', 'j']:
                    normalized[standard_name] = True
                elif val in ['false', '0', 'no', 'nee', 'n']:
                    normalized[standard_name] = False
                else:
                    normalized[standard_name] = val if val else None
            else:
                # String fields
                normalized[standard_name] = str(value).strip() if str(value).strip() else None
        else:
            # Keep original field name for raw data
            normalized[original_header] = str(value).strip() if str(value).strip() else None
    
    return normalized

@router.post("/", response_model=IngestResponse)
async def ingest_data(file: UploadFile = File(...)):
    """
    Enhanced data ingestion endpoint
    Accepts CSV/XLSX files and normalizes them into the database
    """
    try:
        # Read file content
        content = await file.read()
        
        # Detect file type
        file_type = detect_file_type(file.filename, content)
        
        # Parse file based on type
        if file_type in ['xlsx', 'xls']:
            df = parse_excel_content(content)
        else:
            df = parse_csv_content(content)
        
        if df.empty:
            raise HTTPException(status_code=400, detail="File is empty or could not be parsed")
        
        # Normalize headers
        header_mapping = normalize_headers(df.columns.tolist())
        
        # Process rows
        inserted = 0
        skipped = 0
        errors = 0
        error_details = []
        
        for index, row in df.iterrows():
            try:
                # Normalize row data
                normalized_row = normalize_row(row, header_mapping)
                
                # Validate required fields
                if not normalized_row.get('survey_type') or not normalized_row.get('nps_score'):
                    skipped += 1
                    error_details.append(f"Row {index + 1}: Missing required fields (survey_type or nps_score)")
                    continue
                
                # Validate NPS score
                nps_score = normalized_row.get('nps_score')
                if nps_score is None or not (0 <= nps_score <= 10):
                    skipped += 1
                    error_details.append(f"Row {index + 1}: Invalid NPS score: {nps_score}")
                    continue
                
                # Here you would insert into database
                # For now, we'll just count as inserted
                inserted += 1
                
            except Exception as e:
                errors += 1
                error_details.append(f"Row {index + 1}: {str(e)}")
                continue
        
        return IngestResponse(
            inserted=inserted,
            skipped=skipped,
            errors=errors,
            error_details=error_details
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@router.get("/test")
async def test_ingest():
    """Test endpoint to verify ingestion service is working"""
    return {"status": "ingestion service is running", "version": "1.0.0"}
