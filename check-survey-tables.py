#!/usr/bin/env python3

import os
import sys
from supabase import create_client, Client

# Load environment variables
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing environment variables:")
    print(f"SUPABASE_URL: {'✅' if SUPABASE_URL else '❌'}")
    print(f"SUPABASE_KEY: {'✅' if SUPABASE_KEY else '❌'}")
    sys.exit(1)

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("🔍 Checking survey analysis tables...")
    
    # Check if tables exist by trying to query them
    tables_to_check = [
        'survey_analysis_surveys',
        'survey_analysis_responses', 
        'survey_analysis_themes',
        'survey_analysis_insights'
    ]
    
    for table in tables_to_check:
        try:
            result = supabase.table(table).select('*').limit(1).execute()
            print(f"✅ {table} - exists")
        except Exception as e:
            print(f"❌ {table} - missing ({str(e)[:100]}...)")
    
    print("\n📋 If tables are missing, run this SQL in Supabase:")
    print("sql/009_survey_analysis_tables.sql")
    
except Exception as e:
    print(f"❌ Database connection failed: {e}")
    sys.exit(1)
