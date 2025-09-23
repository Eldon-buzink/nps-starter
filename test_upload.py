#!/usr/bin/env python3

import requests
import json

# Test the upload endpoint
url = "http://localhost:8001/ingest/"

# Read the sample file
with open("sample_nps_data.csv", "rb") as f:
    files = {"file": ("sample_nps_data.csv", f, "text/csv")}
    
    print("Testing upload...")
    response = requests.post(url, files=files)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Inserted: {data.get('inserted', 0)}")
        print(f"Skipped: {data.get('skipped', 0)}")
        print(f"Errors: {data.get('errors', 0)}")
        if data.get('error_details'):
            print(f"Error Details: {data.get('error_details')}")
