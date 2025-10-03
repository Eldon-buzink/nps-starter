"""
Simple script to run enrichment without prompts
Usage: python3 run_enrichment.py <number_of_batches>
Example: python3 run_enrichment.py 5  (process 5 batches = 500 responses)
Example: python3 run_enrichment.py all  (process everything)
"""

import sys
import os
import requests
import time
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# API endpoint - use Next.js frontend (not backend)
ENRICH_ENDPOINT = "http://localhost:3001/api/enrich"

def get_pending_count():
    """Get count of pending enrichments"""
    # Responses with comments  
    with_comments_result = supabase.table("nps_response").select("id", count="exact").filter("nps_explanation", "not.is", "null").neq("nps_explanation", "").execute()
    comments_count = with_comments_result.count if with_comments_result.count else 0
    
    # Get unique enriched response IDs
    enriched_data = supabase.table("nps_ai_enrichment").select("response_id").execute()
    unique_enriched = len(set(row['response_id'] for row in enriched_data.data)) if enriched_data.data else 0
    
    return comments_count - unique_enriched

def run_enrichment(max_batches=None):
    """Run enrichment"""
    print(f"\n🚀 Starting enrichment...")
    if max_batches:
        print(f"   Max batches: {max_batches}")
    else:
        print(f"   Max batches: unlimited (will process all)")
    
    total_processed = 0
    total_failed = 0
    total_skipped = 0
    batch_num = 0
    
    while True:
        batch_num += 1
        
        if max_batches and batch_num > max_batches:
            print(f"\n⏸️  Reached max batches limit ({max_batches})")
            break
        
        print(f"\n📦 Batch #{batch_num}...", end=" ", flush=True)
        
        try:
            response = requests.post(ENRICH_ENDPOINT, timeout=300)
            
            if response.status_code != 200:
                print(f"\n❌ Error: {response.status_code}")
                break
            
            result = response.json()
            
            processed = result.get('processed', 0)
            skipped = result.get('skipped_no_comment', 0)
            failed = result.get('failed', 0)
            
            total_processed += processed
            total_failed += failed
            total_skipped += skipped
            
            print(f"✅ {processed} processed, {skipped} skipped, {failed} failed")
            
            if processed == 0 and skipped == 0:
                print("\n✨ All done!")
                break
            
            time.sleep(2)
            
        except Exception as e:
            print(f"\n❌ Error: {str(e)}")
            break
    
    print(f"\n📊 SUMMARY:")
    print(f"   Batches: {batch_num}")
    print(f"   Processed: {total_processed}")
    print(f"   Skipped: {total_skipped}")
    print(f"   Failed: {total_failed}")
    
    return total_processed

if __name__ == "__main__":
    print("=" * 60)
    print("🤖 NPS BULK ENRICHMENT")
    print("=" * 60)
    
    # Check args
    if len(sys.argv) < 2:
        print("\n❌ Usage: python3 run_enrichment.py <batches>")
        print("   Examples:")
        print("     python3 run_enrichment.py 5     (process 5 batches = 500 responses)")
        print("     python3 run_enrichment.py 10    (process 10 batches = 1000 responses)")
        print("     python3 run_enrichment.py all   (process everything)")
        sys.exit(1)
    
    # Get pending count
    pending = get_pending_count()
    print(f"\n⏳ Pending enrichment: {pending:,} responses")
    
    if pending == 0:
        print("✨ Nothing to process!")
        sys.exit(0)
    
    # Parse batches argument
    batches_arg = sys.argv[1]
    if batches_arg.lower() == 'all':
        max_batches = None
        print(f"   Will process ALL {pending:,} responses")
        print(f"   Estimated time: ~{(pending * 2 / 60):.0f} minutes")
    else:
        try:
            max_batches = int(batches_arg)
            responses_to_process = min(max_batches * 100, pending)
            print(f"   Will process up to {responses_to_process:,} responses")
            print(f"   Estimated time: ~{(responses_to_process * 2 / 60):.0f} minutes")
        except:
            print(f"❌ Invalid argument: {batches_arg}")
            sys.exit(1)
    
    # Run it
    processed = run_enrichment(max_batches)
    
    # Final stats
    remaining = get_pending_count()
    print(f"\n✅ COMPLETE!")
    print(f"   Processed: {processed}")
    print(f"   Remaining: {remaining:,}")

