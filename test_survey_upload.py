#!/usr/bin/env python3

import requests
import json

# Test survey upload
def test_survey_upload():
    url = "http://localhost:3008/api/survey-analysis/upload"
    
    # Create a simple CSV content
    csv_content = """response_text
I love the new interface! It's much more intuitive and user-friendly.
The customer support team was amazing. They resolved my issue within minutes.
I'm having trouble with the login process. It keeps asking me to reset my password.
The product quality has improved significantly. The materials feel more durable.
Pricing is too high compared to competitors. I understand the value but it's still difficult to justify the cost for our budget."""
    
    files = {
        'file': ('test_survey.csv', csv_content, 'text/csv')
    }
    
    data = {
        'surveyName': 'Test Survey',
        'responseColumn': 'response_text'
    }
    
    try:
        response = requests.post(url, files=files, data=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            survey_id = result.get('surveyId')
            print(f"Survey ID: {survey_id}")
            
            # Check status
            status_url = f"http://localhost:3008/api/survey-analysis/status?surveyId={survey_id}"
            status_response = requests.get(status_url)
            print(f"Status: {status_response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_survey_upload()
