#!/usr/bin/env python3
import os
import time
from supabase import create_client

def check_progress():
    sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    
    # Get counts
    total_with_comments = sb.table('nps_response').select('id', count='exact').filter('nps_explanation', 'not.is', 'null').execute()
    gpt4o_count = sb.table('nps_ai_enrichment').select('response_id', count='exact').eq('model', 'gpt-4o-mini').execute()
    
    total = total_with_comments.count
    completed = gpt4o_count.count
    progress = (completed / total) * 100 if total > 0 else 0
    
    print(f"🔄 Re-enrichment Progress: {progress:.1f}% ({completed:,}/{total:,})")
    print(f"⏱️  Estimated time remaining: {((total - completed) / 60):.1f} minutes")
    
    return completed, total

if __name__ == "__main__":
    print("Monitoring re-enrichment progress...")
    print("Press Ctrl+C to stop")
    
    try:
        while True:
            completed, total = check_progress()
            if completed >= total:
                print("🎉 Re-enrichment complete!")
                break
            time.sleep(30)  # Check every 30 seconds
    except KeyboardInterrupt:
        print("\nMonitoring stopped.")
