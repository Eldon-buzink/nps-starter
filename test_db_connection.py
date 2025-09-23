#!/usr/bin/env python3
"""
Test database connection and basic operations
Run this to verify your Supabase setup is working
"""

import os
from supabase import create_client, Client

def test_database_connection():
    """Test the database connection and basic operations"""
    
    # Get environment variables
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("❌ Missing Supabase credentials!")
        print("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables")
        return False
    
    try:
        # Create Supabase client
        supabase: Client = create_client(url, key)
        print("✅ Supabase client created successfully")
        
        # Test connection by querying a simple table
        result = supabase.table('nps_response').select('*').limit(1).execute()
        print(f"✅ Database connection successful! Found {len(result.data)} records in nps_response")
        
        # Test inserting a test record
        test_data = {
            'survey_name': 'Test Survey',
            'nps_score': 8,
            'nps_explanation': 'Test comment',
            'nps_category': 'passive'
        }
        
        insert_result = supabase.table('nps_response').insert(test_data).execute()
        
        if insert_result.data:
            print("✅ Test record inserted successfully!")
            
            # Clean up test record
            test_id = insert_result.data[0]['id']
            supabase.table('nps_response').delete().eq('id', test_id).execute()
            print("✅ Test record cleaned up")
            
            return True
        else:
            print("❌ Failed to insert test record")
            return False
            
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("🔍 Testing Supabase database connection...")
    success = test_database_connection()
    
    if success:
        print("\n🎉 Database setup is working correctly!")
        print("You can now upload CSV files and they will be stored in the database.")
    else:
        print("\n❌ Database setup needs attention.")
        print("Please run the sql/simple_setup.sql script in Supabase SQL Editor first.")
