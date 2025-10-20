#!/usr/bin/env python3
"""
Re-enrich responses that are currently classified as "Other" or "overige"
to apply the new synonym mappings and better theme classification.
"""

import os
import sys
import json
from supabase import create_client, Client
from openai import OpenAI
import time
from typing import List, Dict, Any

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY]):
    print("❌ Missing environment variables. Please set:")
    print("   - SUPABASE_URL")
    print("   - SUPABASE_ANON_KEY") 
    print("   - OPENAI_API_KEY")
    sys.exit(1)

# Initialize clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai = OpenAI(api_key=OPENAI_API_KEY)

def get_other_category_responses(limit: int = 100) -> List[Dict[str, Any]]:
    """Get responses that are currently classified as 'Other' or 'overige'"""
    
    # Get responses with "Other" or "overige" themes
    response = supabase.table('nps_ai_enrichment').select("""
        id,
        response_id,
        themes,
        nps_response!inner(
            id,
            title_text,
            nps_explanation,
            nps_score
        )
    """).contains('themes', ['Other']).limit(limit).execute()
    
    if response.data:
        print(f"Found {len(response.data)} responses with 'Other' theme")
        return response.data
    
    # Also check for "overige" theme
    response = supabase.table('nps_ai_enrichment').select("""
        id,
        response_id,
        themes,
        nps_response!inner(
            id,
            title_text,
            nps_explanation,
            nps_score
        )
    """).contains('themes', ['overige']).limit(limit).execute()
    
    if response.data:
        print(f"Found {len(response.data)} responses with 'overige' theme")
        return response.data
    
    print("No responses found with 'Other' or 'overige' themes")
    return []

def enrich_with_improved_classification(response_data: Dict[str, Any]) -> Dict[str, Any]:
    """Re-enrich a response with improved theme classification"""
    
    # Handle different data structures
    if 'nps_response' in response_data:
        nps_response = response_data['nps_response']
    else:
        nps_response = response_data
    
    comment = nps_response.get('nps_explanation', '')
    
    if not comment or len(comment.strip()) < 10:
        return None
    
    # Enhanced prompt with better content quality guidance
    prompt = f"""
Analyze this Dutch customer feedback and classify it into the most appropriate theme(s).

Customer feedback: "{comment}"

Classify this feedback into ONE OR MORE of these specific themes:

**Content Quality (content_kwaliteit):**
- Article quality, writing style, depth of reporting
- News coverage, local news, regional news, political news
- Content variety, interesting topics, journalism quality
- Objectivity, bias, credibility, factual accuracy
- Examples: "limited regional news", "political bias", "article quality", "news coverage"

**Delivery (bezorging):**
- Delivery timing, late delivery, delivery issues
- Physical delivery problems, missed deliveries
- Examples: "late delivery", "delivery problems", "missed newspaper"

**Customer Service (klantenservice):**
- Support quality, helpdesk, customer assistance
- Response time, problem resolution
- Examples: "poor support", "unhelpful staff", "slow response"

**Pricing (pricing):**
- Cost, subscription price, value for money
- Examples: "too expensive", "good value", "price increase"

**User Experience (app_ux):**
- Website/app usability, navigation, design
- Technical issues, performance
- Examples: "hard to navigate", "app crashes", "slow loading"

**Communication (communicatie):**
- Email notifications, communication quality
- Information sharing, updates
- Examples: "no email updates", "poor communication"

**Brand Trust (merkvertrouwen):**
- Trust, credibility, reputation
- Examples: "don't trust", "reliable source", "credible"

**Other (overige):**
- Only use this for themes that don't fit the above categories

Return your response as a JSON array of theme names (use the exact theme names in parentheses above).
Focus on the PRIMARY concern(s) mentioned in the feedback.

Example: ["content_kwaliteit", "bezorging"]
"""

    try:
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at analyzing customer feedback and classifying it into business-relevant themes. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=200
        )
        
        # Parse the response
        content = response.choices[0].message.content.strip()
        
        # Handle markdown code blocks
        if content.startswith('```json'):
            content = content[7:]
        if content.endswith('```'):
            content = content[:-3]
        if content.startswith('```'):
            content = content[3:]
            
        themes = json.loads(content.strip())
        
        # Validate themes
        valid_themes = [
            'content_kwaliteit', 'bezorging', 'klantenservice', 'pricing', 
            'app_ux', 'communicatie', 'merkvertrouwen', 'overige'
        ]
        
        themes = [t for t in themes if t in valid_themes]
        
        if not themes:
            themes = ['overige']
            
        return {
            'themes': themes,
            'original_themes': response_data.get('themes', []),
            'response_id': response_data.get('response_id', nps_response.get('id', ''))
        }
        
    except Exception as e:
        response_id = response_data.get('response_id', nps_response.get('id', 'unknown'))
        print(f"Error enriching response {response_id}: {e}")
        return None

def update_enrichment(enrichment_id: str, new_themes: List[str]) -> bool:
    """Update the enrichment record with new themes"""
    try:
        response = supabase.table('nps_ai_enrichment').update({
            'themes': new_themes
        }).eq('id', enrichment_id).execute()
        
        return len(response.data) > 0
    except Exception as e:
        print(f"Error updating enrichment {enrichment_id}: {e}")
        return False

def main():
    print("🔄 Starting re-enrichment of 'Other' category responses...")
    
    # Get responses to re-enrich
    responses = get_other_category_responses(limit=50)  # Start with 50
    
    if not responses:
        print("No responses found to re-enrich")
        return
    
    print(f"📊 Processing {len(responses)} responses...")
    
    updated_count = 0
    error_count = 0
    
    for i, response_data in enumerate(responses, 1):
        print(f"\n[{i}/{len(responses)}] Processing response {response_data['response_id']}...")
        
        # Re-enrich the response
        enrichment_result = enrich_with_improved_classification(response_data)
        
        if enrichment_result:
            # Update the database
            success = update_enrichment(
                response_data['id'], 
                enrichment_result['themes']
            )
            
            if success:
                updated_count += 1
                print(f"✅ Updated: {enrichment_result['original_themes']} → {enrichment_result['themes']}")
            else:
                error_count += 1
                print(f"❌ Failed to update database")
        else:
            error_count += 1
            print(f"❌ Failed to re-enrich")
        
        # Rate limiting
        time.sleep(0.5)
    
    print(f"\n🎉 Re-enrichment complete!")
    print(f"✅ Successfully updated: {updated_count}")
    print(f"❌ Errors: {error_count}")
    print(f"📊 Total processed: {len(responses)}")

if __name__ == "__main__":
    main()
