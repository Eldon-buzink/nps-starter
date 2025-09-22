"""
AI enrichment endpoint for NPS data
Uses OpenAI GPT-4o-mini for Dutch taxonomy analysis and embeddings
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import openai
from openai import AsyncOpenAI
import time
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/enrich", tags=["ai-enrichment"])

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class EnrichmentResponse(BaseModel):
    processed: int
    retried: int
    failed: int
    skipped_no_comment: int
    error_details: List[str] = []

class EnrichmentRequest(BaseModel):
    batch_size: int = 50
    max_retries: int = 3
    force_reprocess: bool = False

# Dutch taxonomy for NPS themes
DUTCH_TAXONOMY = """
Analyseer de volgende NPS commentaar en categoriseer volgens deze Nederlandse thema's:

THEMA'S:
- Klantenservice: service, support, hulp, klantenservice, medewerker
- Productkwaliteit: kwaliteit, product, functionaliteit, features, prestaties
- Prijs/Value: prijs, kosten, waarde, duur, betaalbaar
- Gebruiksvriendelijkheid: gebruiksvriendelijk, interface, navigatie, makkelijk, moeilijk
- Betrouwbaarheid: betrouwbaar, stabiel, consistent, fout, bug
- Innovatie: nieuw, innovatief, modern, verouderd, achterhaald
- Communicatie: communicatie, informatie, transparantie, duidelijkheid
- Levering: levering, bezorging, snelheid, timing
- Technische problemen: technisch, probleem, storing, uitval
- Algemene tevredenheid: tevreden, blij, positief, negatief, ontevreden

Geef een JSON response met:
{
  "themes": ["lijst van relevante thema's"],
  "theme_scores": {"thema": score_0_1},
  "sentiment": -1.0 tot 1.0 (null als onduidelijk),
  "keywords": ["belangrijke woorden"],
  "language": "nl"
}
"""

async def analyze_comment_with_ai(comment: str) -> Dict[str, Any]:
    """Analyze comment using OpenAI with Dutch taxonomy"""
    try:
        prompt = f"{DUTCH_TAXONOMY}\n\nCommentaar: \"{comment}\""
        
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Je bent een expert in Nederlandse NPS analyse. Geef altijd een geldige JSON response."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return result
        
    except Exception as e:
        logging.error(f"AI analysis failed: {str(e)}")
        return {
            "themes": [],
            "theme_scores": {},
            "sentiment": None,
            "keywords": [],
            "language": "nl"
        }

async def create_embedding(text: str) -> Optional[List[float]]:
    """Create embedding using OpenAI text-embedding-3-large"""
    try:
        response = await client.embeddings.create(
            model="text-embedding-3-large",
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        logging.error(f"Embedding creation failed: {str(e)}")
        return None

def categorize_nps_score(score: int) -> str:
    """Categorize NPS score into promoter/passive/detractor"""
    if score >= 9:
        return "promoter"
    elif score >= 7:
        return "passive"
    else:
        return "detractor"

async def process_batch(responses: List[Dict], batch_id: int) -> Dict[str, int]:
    """Process a batch of responses for AI enrichment"""
    processed = 0
    retried = 0
    failed = 0
    skipped = 0
    
    for response in responses:
        try:
            comment = response.get('nps_explanation')
            if not comment or comment.strip() in ['', 'n.v.t.', 'nvt']:
                skipped += 1
                continue
            
            # AI analysis
            ai_result = await analyze_comment_with_ai(comment)
            
            # Create embedding
            embedding = await create_embedding(comment)
            
            # Prepare enrichment data
            enrichment_data = {
                "response_id": response['id'],
                "themes": ai_result.get('themes', []),
                "theme_scores": ai_result.get('theme_scores', {}),
                "sentiment_score": ai_result.get('sentiment'),
                "sentiment_label": "positive" if ai_result.get('sentiment', 0) > 0.1 else "negative" if ai_result.get('sentiment', 0) < -0.1 else "neutral",
                "keywords": ai_result.get('keywords', []),
                "summary": f"Analyse van {len(ai_result.get('themes', []))} thema's",
                "embedded_vector": embedding,
                "ai_model": "gpt-4o-mini",
                "processing_status": "completed",
                "language": ai_result.get('language', 'nl')
            }
            
            # Here you would insert into nps_ai_enrichment table
            # For now, we'll just count as processed
            processed += 1
            
            # Add small delay to avoid rate limiting
            await asyncio.sleep(0.1)
            
        except Exception as e:
            logging.error(f"Error processing response {response.get('id')}: {str(e)}")
            failed += 1
            continue
    
    return {
        "processed": processed,
        "retried": retried,
        "failed": failed,
        "skipped": skipped
    }

async def get_unprocessed_responses(batch_size: int, force_reprocess: bool = False) -> List[Dict]:
    """Get responses that need AI enrichment"""
    # This would query your database for unprocessed responses
    # For now, return mock data
    return [
        {
            "id": "mock-id-1",
            "nps_score": 9,
            "nps_explanation": "Geweldige service, zeer tevreden!",
            "survey_name": "LLT_Nieuws"
        },
        {
            "id": "mock-id-2", 
            "nps_score": 4,
            "nps_explanation": "Slechte klantenservice, lang wachten",
            "survey_name": "LLT_Nieuws"
        }
    ]

@router.post("/", response_model=EnrichmentResponse)
async def enrich_responses(
    request: EnrichmentRequest,
    background_tasks: BackgroundTasks
):
    """
    Enrich NPS responses with AI analysis
    Processes responses in batches with exponential backoff
    """
    try:
        # Get unprocessed responses
        responses = await get_unprocessed_responses(
            request.batch_size, 
            request.force_reprocess
        )
        
        if not responses:
            return EnrichmentResponse(
                processed=0,
                retried=0,
                failed=0,
                skipped_no_comment=0
            )
        
        # Process in batches
        total_processed = 0
        total_retried = 0
        total_failed = 0
        total_skipped = 0
        error_details = []
        
        # Split into batches
        for i in range(0, len(responses), request.batch_size):
            batch = responses[i:i + request.batch_size]
            batch_id = i // request.batch_size + 1
            
            try:
                # Process batch with retry logic
                retry_count = 0
                while retry_count < request.max_retries:
                    try:
                        batch_result = await process_batch(batch, batch_id)
                        total_processed += batch_result['processed']
                        total_retried += batch_result['retried']
                        total_failed += batch_result['failed']
                        total_skipped += batch_result['skipped']
                        break
                        
                    except Exception as e:
                        retry_count += 1
                        if retry_count >= request.max_retries:
                            error_details.append(f"Batch {batch_id} failed after {request.max_retries} retries: {str(e)}")
                            total_failed += len(batch)
                        else:
                            # Exponential backoff
                            await asyncio.sleep(2 ** retry_count)
                            total_retried += len(batch)
                
                # Rate limiting delay between batches
                await asyncio.sleep(1)
                
            except Exception as e:
                error_details.append(f"Batch {batch_id} error: {str(e)}")
                total_failed += len(batch)
        
        return EnrichmentResponse(
            processed=total_processed,
            retried=total_retried,
            failed=total_failed,
            skipped_no_comment=total_skipped,
            error_details=error_details
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")

@router.get("/status")
async def get_enrichment_status():
    """Get current enrichment status"""
    # This would query your database for enrichment statistics
    return {
        "total_responses": 100,
        "enriched": 75,
        "pending": 20,
        "failed": 5,
        "last_processed": "2025-09-22T10:00:00Z"
    }

@router.post("/test")
async def test_enrichment():
    """Test AI enrichment with sample data"""
    try:
        sample_comment = "Geweldige service, zeer tevreden met de kwaliteit!"
        result = await analyze_comment_with_ai(sample_comment)
        embedding = await create_embedding(sample_comment)
        
        return {
            "status": "success",
            "sample_analysis": result,
            "embedding_length": len(embedding) if embedding else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")
