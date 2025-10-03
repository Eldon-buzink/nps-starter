"""
Bulk AI Enrichment Script for NPS Responses
Processes all un-enriched responses with comments across all titles
"""

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
    raise RuntimeError("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# API endpoint
API_URL = os.getenv("NEXT_PUBLIC_API_URL", "http://localhost:3000")
ENRICH_ENDPOINT = f"{API_URL}/api/enrich"

def get_enrichment_stats():
    """Get current enrichment statistics"""
    print("\n📊 Checking current enrichment status...\n")
    
    # Total responses
    total_result = supabase.table("nps_response").select("id", count="exact").execute()
    total = total_result.count if total_result.count else 0
    
    # Responses with comments  
    with_comments_result = supabase.table("nps_response").select("id", count="exact").filter("nps_explanation", "not.is", "null").neq("nps_explanation", "").execute()
    comments_count = with_comments_result.count if with_comments_result.count else 0
    
    # Get unique enriched response IDs (since one response can have multiple rows)
    enriched_data = supabase.table("nps_ai_enrichment").select("response_id").execute()
    unique_enriched = len(set(row['response_id'] for row in enriched_data.data)) if enriched_data.data else 0
    
    # Pending = responses with comments but not enriched
    pending = comments_count - unique_enriched
    
    print(f"✅ Total Responses: {total:,}")
    print(f"💬 With Comments: {comments_count:,} ({(comments_count/total*100):.1f}%)")
    print(f"🤖 Already Enriched: {unique_enriched:,} ({(unique_enriched/comments_count*100 if comments_count > 0 else 0):.1f}% of comments)")
    print(f"⏳ Pending Enrichment: {pending:,}")
    print(f"\n📈 Overall Coverage: {(unique_enriched/total*100):.1f}% of all responses")
    
    return {
        'total': total,
        'with_comments': comments_count,
        'enriched': unique_enriched,
        'pending': pending
    }

def get_unenriched_by_title():
    """Get breakdown of unenriched responses by title"""
    print("\n📋 Checking unenriched responses by title...\n")
    
    # Get all responses with comments
    responses_result = supabase.table("nps_response").select("id, title_text").filter("nps_explanation", "not.is", "null").neq("nps_explanation", "").execute()
    
    # Get all enriched response IDs
    enriched_result = supabase.table("nps_ai_enrichment").select("response_id").execute()
    
    enriched_ids = set(row['response_id'] for row in enriched_result.data) if enriched_result.data else set()
    
    # Count by title
    title_stats = {}
    for row in responses_result.data or []:
        title = row['title_text']
        if title not in title_stats:
            title_stats[title] = {'total': 0, 'enriched': 0, 'pending': 0}
        
        title_stats[title]['total'] += 1
        if row['id'] in enriched_ids:
            title_stats[title]['enriched'] += 1
        else:
            title_stats[title]['pending'] += 1
    
    # Sort by pending (most unenriched first)
    sorted_titles = sorted(title_stats.items(), key=lambda x: x[1]['pending'], reverse=True)
    
    print(f"{'Title':<30} {'Total':<10} {'Enriched':<12} {'Pending':<10} {'Coverage':<10}")
    print("-" * 80)
    for title, stats in sorted_titles[:15]:  # Show top 15
        coverage = (stats['enriched'] / stats['total'] * 100) if stats['total'] > 0 else 0
        print(f"{title[:28]:<30} {stats['total']:<10} {stats['enriched']:<12} {stats['pending']:<10} {coverage:>6.1f}%")
    
    if len(sorted_titles) > 15:
        print(f"\n... and {len(sorted_titles) - 15} more titles")
    
    return title_stats

def run_bulk_enrichment(batch_size=100, max_batches=None):
    """Run bulk enrichment by calling the API endpoint repeatedly"""
    print("\n🚀 Starting bulk enrichment process...\n")
    
    total_processed = 0
    total_failed = 0
    total_skipped = 0
    batch_num = 0
    
    while True:
        batch_num += 1
        
        if max_batches and batch_num > max_batches:
            print(f"\n⏸️  Reached max batches limit ({max_batches})")
            break
        
        print(f"\n📦 Processing Batch #{batch_num}...")
        print(f"   Calling: POST {ENRICH_ENDPOINT}")
        
        try:
            # Call the enrichment endpoint
            response = requests.post(ENRICH_ENDPOINT, timeout=300)  # 5 min timeout
            
            if response.status_code != 200:
                print(f"❌ Error: {response.status_code} - {response.text}")
                break
            
            result = response.json()
            
            processed = result.get('processed', 0)
            skipped = result.get('skipped_no_comment', 0)
            failed = result.get('failed', 0)
            themes_discovered = result.get('themes_discovered', 0)
            
            total_processed += processed
            total_failed += failed
            total_skipped += skipped
            
            print(f"   ✅ Processed: {processed}")
            print(f"   ⏭️  Skipped (no comment): {skipped}")
            print(f"   ❌ Failed: {failed}")
            print(f"   🎯 Themes discovered: {themes_discovered}")
            
            # If no responses were processed, we're done
            if processed == 0 and skipped == 0:
                print("\n✨ All responses have been enriched!")
                break
            
            # Progress summary
            print(f"\n📊 Total Progress:")
            print(f"   Processed: {total_processed}")
            print(f"   Skipped: {total_skipped}")
            print(f"   Failed: {total_failed}")
            
            # Small delay between batches
            time.sleep(2)
            
        except requests.exceptions.Timeout:
            print("⏱️  Request timed out. Continuing to next batch...")
            continue
        except Exception as e:
            print(f"❌ Error in batch {batch_num}: {str(e)}")
            break
    
    return {
        'total_processed': total_processed,
        'total_failed': total_failed,
        'total_skipped': total_skipped,
        'batches': batch_num
    }

def main():
    """Main function"""
    print("=" * 80)
    print("🤖 NPS BULK AI ENRICHMENT TOOL")
    print("=" * 80)
    
    # Step 1: Show current stats
    stats = get_enrichment_stats()
    
    # Step 2: Show breakdown by title
    title_stats = get_unenriched_by_title()
    
    # Step 3: Ask for confirmation
    if stats['pending'] == 0:
        print("\n✨ All responses with comments are already enriched!")
        return
    
    print(f"\n🎯 Ready to enrich {stats['pending']:,} responses")
    print(f"   Estimated time: ~{(stats['pending'] * 2 / 60):.1f} minutes")
    print(f"   Estimated cost: ~${(stats['pending'] * 0.002):.2f} (OpenAI API)")
    
    confirm = input("\n❓ Continue with bulk enrichment? (yes/no): ")
    
    if confirm.lower() not in ['yes', 'y']:
        print("\n❌ Enrichment cancelled")
        return
    
    # Step 4: Run enrichment
    # For safety, let's start with max 10 batches (1000 responses)
    # You can remove this limit once you're confident it works
    max_batches = input("\n❓ How many batches to process? (Enter number or 'all' for unlimited): ")
    
    if max_batches.lower() == 'all':
        max_batches = None
    else:
        try:
            max_batches = int(max_batches)
        except:
            print("❌ Invalid input. Using default of 10 batches.")
            max_batches = 10
    
    result = run_bulk_enrichment(batch_size=100, max_batches=max_batches)
    
    # Step 5: Show final stats
    print("\n" + "=" * 80)
    print("✅ ENRICHMENT COMPLETE!")
    print("=" * 80)
    print(f"Total Batches: {result['batches']}")
    print(f"Total Processed: {result['total_processed']}")
    print(f"Total Skipped: {result['total_skipped']}")
    print(f"Total Failed: {result['total_failed']}")
    
    # Show updated stats
    print("\n📊 Updated Statistics:")
    get_enrichment_stats()

if __name__ == "__main__":
    main()

