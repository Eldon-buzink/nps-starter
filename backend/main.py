from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
import io
import json
from typing import List, Optional
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import openai
from datetime import datetime, date

# Import new modules
from app.ingest import router as ingest_router
from app.enrich import router as enrich_router

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="NPS Insights API",
    description="API for Net Promoter Score analysis and insights",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ingest_router)
app.include_router(enrich_router)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

# Pydantic models
class NPSResponse(BaseModel):
    id: Optional[str] = None
    survey_name: str
    nps_score: int
    nps_explanation: Optional[str] = None
    gender: Optional[str] = None
    age_range: Optional[str] = None
    years_employed: Optional[str] = None
    creation_date: Optional[date] = None
    title_text: Optional[str] = None
    nps_category: Optional[str] = None
    word_count: Optional[int] = None
    has_explanation: Optional[bool] = None

class NPSSurveyMetrics(BaseModel):
    survey_name: str
    total_responses: int
    promoters: int
    passives: int
    detractors: int
    average_score: float
    nps_score: float
    first_response: Optional[date] = None
    last_response: Optional[date] = None

class AIEnrichment(BaseModel):
    themes: List[str]
    sentiment_score: float
    sentiment_label: str
    keywords: List[str]
    summary: str

# Helper functions
def categorize_nps_score(score: int) -> str:
    """Categorize NPS score into promoter, passive, or detractor"""
    if score >= 9:
        return "promoter"
    elif score >= 7:
        return "passive"
    else:
        return "detractor"

def calculate_nps_score(promoters: int, detractors: int, total: int) -> float:
    """Calculate NPS score from promoter and detractor counts"""
    if total == 0:
        return 0.0
    return round(((promoters / total) - (detractors / total)) * 100, 2)

async def enrich_with_ai(explanation: str) -> AIEnrichment:
    """Use OpenAI to enrich NPS explanation with themes, sentiment, and keywords"""
    if not explanation or len(explanation.strip()) < 10:
        return AIEnrichment(
            themes=[],
            sentiment_score=0.0,
            sentiment_label="neutral",
            keywords=[],
            summary=""
        )
    
    try:
        prompt = f"""
        Analyze this NPS response explanation and provide insights in JSON format:
        
        Response: "{explanation}"
        
        Please provide:
        1. themes: Array of main themes/topics mentioned (max 5)
        2. sentiment_score: Sentiment score from -1.0 (very negative) to 1.0 (very positive)
        3. sentiment_label: "positive", "negative", or "neutral"
        4. keywords: Array of key words/phrases (max 10)
        5. summary: Brief summary of the response (max 100 characters)
        
        Respond with valid JSON only.
        """
        
        response = await openai.ChatCompletion.acreate(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.3
        )
        
        result = json.loads(response.choices[0].message.content)
        return AIEnrichment(**result)
        
    except Exception as e:
        print(f"AI enrichment error: {e}")
        return AIEnrichment(
            themes=[],
            sentiment_score=0.0,
            sentiment_label="neutral",
            keywords=[],
            summary=""
        )

# API Routes
@app.get("/")
async def root():
    return {"message": "NPS Insights API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Upload and process CSV file with NPS data"""
    try:
        # Read CSV file
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Validate required columns
        required_columns = ['SURVEY', 'NPS']
        if not all(col in df.columns for col in required_columns):
            raise HTTPException(
                status_code=400, 
                detail=f"CSV must contain columns: {required_columns}"
            )
        
        # Process each row
        processed_count = 0
        for _, row in df.iterrows():
            # Map CSV columns to our schema
            nps_data = {
                "survey_name": row.get('SURVEY', ''),
                "nps_score": int(row.get('NPS', 0)),
                "nps_explanation": row.get('NPS_TOELICHTING', ''),
                "gender": row.get('GESLACHT', ''),
                "age_range": row.get('LEEFTIJD', ''),
                "years_employed": row.get('ABOJAREN', ''),
                "creation_date": pd.to_datetime(row.get('CREATIE_DT', '')).date() if pd.notna(row.get('CREATIE_DT')) else None,
                "title_text": row.get('TITEL_TEKST', ''),
                "raw_data": row.to_dict()
            }
            
            # Insert into nps_raw table
            result = supabase.table("nps_raw").insert(nps_data).execute()
            
            if result.data:
                raw_id = result.data[0]['id']
                
                # Process and insert into nps_response table
                response_data = {
                    "raw_id": raw_id,
                    "survey_name": nps_data["survey_name"],
                    "nps_score": nps_data["nps_score"],
                    "nps_explanation": nps_data["nps_explanation"],
                    "gender": nps_data["gender"],
                    "age_range": nps_data["age_range"],
                    "years_employed": nps_data["years_employed"],
                    "creation_date": nps_data["creation_date"],
                    "title_text": nps_data["title_text"],
                    "nps_category": categorize_nps_score(nps_data["nps_score"]),
                    "word_count": len(nps_data["nps_explanation"].split()) if nps_data["nps_explanation"] else 0,
                    "has_explanation": bool(nps_data["nps_explanation"] and nps_data["nps_explanation"].strip())
                }
                
                response_result = supabase.table("nps_response").insert(response_data).execute()
                
                if response_result.data:
                    response_id = response_result.data[0]['id']
                    
                    # AI enrichment (async)
                    if response_data["has_explanation"]:
                        ai_enrichment = await enrich_with_ai(response_data["nps_explanation"])
                        
                        enrichment_data = {
                            "response_id": response_id,
                            "themes": ai_enrichment.themes,
                            "sentiment_score": ai_enrichment.sentiment_score,
                            "sentiment_label": ai_enrichment.sentiment_label,
                            "keywords": ai_enrichment.keywords,
                            "summary": ai_enrichment.summary,
                            "ai_model": "gpt-3.5-turbo",
                            "processing_status": "completed"
                        }
                        
                        supabase.table("nps_ai_enrichment").insert(enrichment_data).execute()
                
                processed_count += 1
        
        return {
            "message": f"Successfully processed {processed_count} rows",
            "total_rows": len(df),
            "processed_rows": processed_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {str(e)}")

@app.get("/surveys", response_model=List[NPSSurveyMetrics])
async def get_surveys():
    """Get all surveys with their metrics"""
    try:
        result = supabase.rpc('get_survey_metrics').execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching surveys: {str(e)}")

@app.get("/surveys/{survey_name}/responses", response_model=List[NPSResponse])
async def get_survey_responses(survey_name: str, limit: int = 100, offset: int = 0):
    """Get responses for a specific survey"""
    try:
        result = supabase.table("nps_response").select("*").eq("survey_name", survey_name).range(offset, offset + limit - 1).execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching responses: {str(e)}")

@app.get("/surveys/{survey_name}/metrics")
async def get_survey_metrics(survey_name: str):
    """Get detailed metrics for a specific survey"""
    try:
        # Get basic metrics
        result = supabase.table("nps_response").select("nps_score, nps_category, creation_date").eq("survey_name", survey_name).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Survey not found")
        
        responses = result.data
        total = len(responses)
        promoters = len([r for r in responses if r['nps_category'] == 'promoter'])
        passives = len([r for r in responses if r['nps_category'] == 'passive'])
        detractors = len([r for r in responses if r['nps_category'] == 'detractor'])
        
        metrics = {
            "survey_name": survey_name,
            "total_responses": total,
            "promoters": promoters,
            "passives": passives,
            "detractors": detractors,
            "average_score": round(sum(r['nps_score'] for r in responses) / total, 2) if total > 0 else 0,
            "nps_score": calculate_nps_score(promoters, detractors, total),
            "first_response": min(r['creation_date'] for r in responses) if responses else None,
            "last_response": max(r['creation_date'] for r in responses) if responses else None
        }
        
        return metrics
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating metrics: {str(e)}")

@app.get("/themes/{survey_name}")
async def get_survey_themes(survey_name: str):
    """Get theme analysis for a specific survey"""
    try:
        result = supabase.table("nps_theme_analysis").select("*").eq("survey_name", survey_name).execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching themes: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
