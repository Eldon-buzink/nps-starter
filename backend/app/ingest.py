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
from supabase import create_client, Client
import os

router = APIRouter(prefix="/ingest", tags=["ingestion"])

# Initialize Supabase client
def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    return create_client(url, key)

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
        # Try common delimiters
        delimiters = [',', ';', '\t', '|']
        delimiter = ','
        for delim in delimiters:
            if delim in sample:
                delimiter = delim
                break
    
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
    import uuid
    upload_id = str(uuid.uuid4())
    upload_progress[upload_id] = {"status": "processing", "progress": 0, "message": "Starting upload..."}
    
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
        print(f"DEBUG: Original headers: {df.columns.tolist()}")
        header_mapping = normalize_headers(df.columns.tolist())
        print(f"DEBUG: Header mapping: {header_mapping}")
        print(f"DEBUG: DataFrame shape: {df.shape}")
        print(f"DEBUG: First few rows:\n{df.head()}")
        upload_progress[upload_id] = {"status": "processing", "progress": 10, "message": "Processing file structure..."}
        
        # Process rows in batches for better performance
        inserted = 0
        skipped = 0
        errors = 0
        error_details = []
        batch_size = 100  # Increased batch size for better performance
        batch_data = []
        total_rows = len(df)
        
        for index, row in df.iterrows():
            try:
                # Normalize row data
                normalized_row = normalize_row(row, header_mapping)
                
                # Validate required fields
                print(f"DEBUG: Row {index + 1}: survey_type={normalized_row.get('survey_type')}, nps_score={normalized_row.get('nps_score')}")
                if not normalized_row.get('survey_type') or not normalized_row.get('nps_score'):
                    skipped += 1
                    error_details.append(f"Row {index + 1}: Missing required fields (survey_type or nps_score)")
                    print(f"DEBUG: Skipping row {index + 1} - missing required fields")
                    continue
                
                # Validate NPS score
                nps_score = normalized_row.get('nps_score')
                if nps_score is None or not (0 <= nps_score <= 10):
                    skipped += 1
                    error_details.append(f"Row {index + 1}: Invalid NPS score: {nps_score}")
                    continue
                
                # Add to batch for processing
                batch_data.append({
                    'index': index,
                    'normalized_row': normalized_row,
                    'nps_score': nps_score
                })
                
                # Process batch when it reaches batch_size or at the end
                if len(batch_data) >= batch_size or index == len(df) - 1:
                    # Update progress
                    progress_pct = min(20 + int((index / total_rows) * 70), 90)
                    upload_progress[upload_id] = {
                        "status": "processing", 
                        "progress": progress_pct, 
                        "message": f"Processing batch {index + 1} of {total_rows} rows..."
                    }
                    
                    try:
                        supabase = get_supabase_client()
                        
                        # Prepare batch data
                        raw_batch = []
                        response_batch = []
                        
                        for batch_item in batch_data:
                            normalized_row = batch_item['normalized_row']
                            nps_score = batch_item['nps_score']
                            
                            raw_batch.append({
                                'survey_name': normalized_row.get('survey_type'),
                                'nps_score': normalized_row.get('nps_score'),
                                'nps_explanation': normalized_row.get('comment'),
                                'gender': normalized_row.get('gender'),
                                'age_range': normalized_row.get('age_band'),
                                'years_employed': normalized_row.get('tenure'),
                                'creation_date': normalized_row.get('created_at'),
                                'title_text': normalized_row.get('title'),
                                'raw_data': json.dumps(normalized_row)
                            })
                        
                        # Batch insert raw data
                        print(f"DEBUG: About to insert {len(raw_batch)} raw records")
                        if raw_batch:
                            try:
                                raw_result = supabase.table('nps_raw').insert(raw_batch).execute()
                                print(f"DEBUG: Raw insert result: {raw_result.data}")
                                
                                if raw_result.data:
                                    # Prepare response batch
                                    for i, raw_item in enumerate(raw_result.data):
                                        batch_item = batch_data[i]
                                        normalized_row = batch_item['normalized_row']
                                        nps_score = batch_item['nps_score']
                                        
                                        response_batch.append({
                                            'raw_id': raw_item['id'],
                                            'survey_name': normalized_row.get('survey_type'),
                                            'nps_score': normalized_row.get('nps_score'),
                                            'nps_explanation': normalized_row.get('comment'),
                                            'gender': normalized_row.get('gender'),
                                            'age_range': normalized_row.get('age_band'),
                                            'years_employed': normalized_row.get('tenure'),
                                            'creation_date': normalized_row.get('created_at'),
                                            'title_text': normalized_row.get('title'),
                                            'nps_category': 'promoter' if nps_score >= 9 else ('passive' if nps_score >= 7 else 'detractor')
                                        })
                                    
                                    # Batch insert response data
                                    if response_batch:
                                        response_result = supabase.table('nps_response').insert(response_batch).execute()
                                        
                                        if response_result.data:
                                            inserted += len(response_batch)
                                        else:
                                            errors += len(batch_data)
                                            error_details.append(f"Batch failed: Failed to insert into nps_response")
                                    else:
                                        errors += len(batch_data)
                                        error_details.append(f"Batch failed: No response data prepared")
                                else:
                                    errors += len(batch_data)
                                    error_details.append(f"Batch failed: Failed to insert into nps_raw")
                                
                                # Clear batch
                                batch_data = []
                                
                            except Exception as db_error:
                                errors += len(batch_data)
                                error_details.append(f"Batch failed: Database error: {str(db_error)}")
                                batch_data = []
                                continue
                    
                    except Exception as e:
                        errors += 1
                        error_details.append(f"Row {index + 1}: {str(e)}")
                        continue

        # Final progress update
        upload_progress[upload_id] = {
            "status": "completed", 
            "progress": 100, 
            "message": f"Upload completed! Inserted: {inserted}, Skipped: {skipped}, Errors: {errors}"
        }

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

# Global progress tracking
upload_progress = {}

@router.get("/progress/{upload_id}")
async def get_progress(upload_id: str):
    """Get upload progress for a specific upload"""
    return upload_progress.get(upload_id, {"status": "not_found"})
