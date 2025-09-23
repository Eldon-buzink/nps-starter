#!/usr/bin/env python3

import pandas as pd
import json

# Test the data processing logic
def test_data_processing():
    # Read the sample file
    df = pd.read_csv("sample_nps_data.csv")
    print(f"DataFrame shape: {df.shape}")
    print(f"Columns: {df.columns.tolist()}")
    print(f"First row: {df.iloc[0].to_dict()}")
    
    # Test header normalization
    header_mapping = {
        'survey': 'survey_type',
        'nps': 'nps_score', 
        'nps_toelichting': 'comment',
        'geslacht': 'gender',
        'leeftijd': 'age_band',
        'abojaren': 'tenure',
        'creatie_dt': 'created_at',
        'subscription_key': 'subscription_key',
        'titel_tekst': 'title',
        'titel': 'title',
        'abo_type': 'subscription_type',
        'elt_proef_gehad': 'had_trial',
        'exit_opzegreden': 'exit_reason'
    }
    
    normalized = {}
    for header in df.columns.tolist():
        clean_header = header.strip().lower().replace(' ', '_')
        if clean_header in header_mapping:
            normalized[header] = header_mapping[clean_header]
        else:
            normalized[header] = clean_header
    
    print(f"Header mapping: {normalized}")
    
    # Test first row processing
    first_row = df.iloc[0]
    print(f"First row data: {first_row.to_dict()}")
    
    # Test normalization
    normalized_row = {}
    for original_header, value in first_row.items():
        if original_header in normalized:
            standard_name = normalized[original_header]
            if standard_name == 'nps_score':
                try:
                    normalized_row[standard_name] = int(float(str(value))) if str(value).strip() else None
                except (ValueError, TypeError):
                    normalized_row[standard_name] = None
            else:
                normalized_row[standard_name] = str(value).strip() if str(value).strip() else None
        else:
            normalized_row[original_header] = str(value).strip() if str(value).strip() else None
    
    print(f"Normalized row: {normalized_row}")
    print(f"Survey type: {normalized_row.get('survey_type')}")
    print(f"NPS score: {normalized_row.get('nps_score')}")

if __name__ == "__main__":
    test_data_processing()
