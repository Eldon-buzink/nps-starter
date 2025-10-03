import os
import time
import json
import re
from openai import OpenAI
from supabase import create_client, Client

# Setup
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Simple theme classification without complex JSON schema
def classify_response(comment):
    """Simple classification using basic completion"""
    prompt = f"""
Classify this Dutch NPS response into themes and sentiment:

Response: "{comment}"

Respond with this exact format:
THEME: [content_kwaliteit|pricing|merkvertrouwen|overige]
SENTIMENT: [promoter|passive|detractor|neutral]
CONFIDENCE: [0.0-1.0]

Example:
THEME: content_kwaliteit
SENTIMENT: promoter
CONFIDENCE: 0.9
"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=50,
            temperature=0.1
        )
        
        text = response.choices[0].message.content.strip()
        
        # Parse the simple format
        theme = re.search(r"THEME:\s*(\w+)", text)
        sentiment = re.search(r"SENTIMENT:\s*(\w+)", text)
        confidence = re.search(r"CONFIDENCE:\s*([\d.]+)", text)
        
        return {
            "theme": theme.group(1) if theme else "overige",
            "sentiment": sentiment.group(1) if sentiment else "neutral", 
            "confidence": float(confidence.group(1)) if confidence else 0.5
        }
    except Exception as e:
        print(f"Error classifying: {e}")
        return {
            "theme": "overige",
            "sentiment": "neutral",
            "confidence": 0.0
        }

def get_unenriched_responses(limit=100):
    """Get responses that haven't been enriched yet"""
    try:
        # Get responses with comments
        result = supabase.table("nps_response").select("id, nps_explanation").filter("nps_explanation", "not.is", "null").neq("nps_explanation", "").limit(limit).execute()
        
        if not result.data:
            return []
            
        # Filter out already enriched ones
        ids = [r["id"] for r in result.data]
        
        try:
            enriched = supabase.table("nps_ai_enrichment").select("response_id").in_("response_id", ids).execute().data or []
            enriched_ids = {e["response_id"] for e in enriched}
            return [r for r in result.data if r["id"] not in enriched_ids and r["nps_explanation"]]
        except:
            # If enrichment table doesn't exist, return all
            return [r for r in result.data if r["nps_explanation"]]
            
    except Exception as e:
        print(f"Error fetching responses: {e}")
        return []

def store_enrichment(response_id, result):
    """Store the enrichment result"""
    try:
        supabase.table("nps_ai_enrichment").upsert({
            "response_id": response_id,
            "model": "gpt-4o-mini",
            "themes": [result["theme"]],
            "primary_theme": result["theme"],
            "sentiment": result["sentiment"],
            "confidence": result["confidence"],
            "raw": result
        }).execute()
        return True
    except Exception as e:
        print(f"Warning: Could not store enrichment for {response_id}: {e}")
        return False

def main():
    print("🚀 Starting simple enrichment...")
    total_processed = 0
    
    while True:
        # Get batch of unenriched responses
        responses = get_unenriched_responses(50)
        
        if not responses:
            print("✅ No more responses to enrich!")
            break
            
        print(f"📦 Processing {len(responses)} responses...")
        
        for response in responses:
            try:
                # Classify the response
                result = classify_response(response["nps_explanation"])
                
                # Store the result
                if store_enrichment(response["id"], result):
                    total_processed += 1
                    
                    if total_processed % 10 == 0:
                        print(f"✅ Processed {total_processed} responses")
                
                # Rate limiting
                time.sleep(0.5)
                
            except Exception as e:
                print(f"❌ Error processing {response['id']}: {e}")
                continue
    
    print(f"🎉 Complete! Processed {total_processed} responses")

if __name__ == "__main__":
    main()
