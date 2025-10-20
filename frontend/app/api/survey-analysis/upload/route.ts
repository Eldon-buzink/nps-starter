import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload a CSV or Excel file.' }, { status: 400 });
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Generate unique survey ID
    const surveyId = uuidv4();
    
    // Read file content
    const fileContent = await file.text();
    
    // Parse CSV content
    const lines = fileContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file must contain at least a header row and one data row' }, { status: 400 });
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataRows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    // Find the response column (look for common patterns)
    const responseColumn = headers.find(header => 
      header.toLowerCase().includes('response') ||
      header.toLowerCase().includes('comment') ||
      header.toLowerCase().includes('feedback') ||
      header.toLowerCase().includes('answer') ||
      header.toLowerCase().includes('text')
    );

    if (!responseColumn) {
      return NextResponse.json({ 
        error: 'Could not find a response column. Please ensure your CSV has a column with open-ended responses.' 
      }, { status: 400 });
    }

    // Filter out empty responses
    const validResponses = dataRows.filter(row => 
      row[responseColumn] && row[responseColumn].trim().length > 10
    );

    if (validResponses.length === 0) {
      return NextResponse.json({ 
        error: 'No valid responses found. Please ensure your response column contains meaningful text.' 
      }, { status: 400 });
    }

    // Store survey metadata
    const { error: surveyError } = await supabase
      .from('survey_analyses')
      .insert({
        id: surveyId,
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        original_filename: file.name,
        total_responses: validResponses.length,
        response_column: responseColumn,
        headers: headers,
        status: 'processing'
      });

    if (surveyError) {
      console.error('Error storing survey metadata:', surveyError);
      return NextResponse.json({ error: 'Failed to store survey data' }, { status: 500 });
    }

    // Store individual responses
    const responses = validResponses.map((row, index) => ({
      survey_id: surveyId,
      response_id: uuidv4(), // Generate unique response ID
      response_text: row[responseColumn],
      metadata: Object.fromEntries(
        Object.entries(row).filter(([key, value]) => key !== responseColumn && value)
      )
    }));

    const { error: responsesError } = await supabase
      .from('survey_responses')
      .insert(responses);

    if (responsesError) {
      console.error('Error storing survey responses:', responsesError);
      return NextResponse.json({ error: 'Failed to store survey responses' }, { status: 500 });
    }

    // Trigger AI analysis asynchronously
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3008'}/api/survey-analysis/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyId })
    }).catch(error => {
      console.error('Failed to trigger processing:', error);
    });
    
    return NextResponse.json({
      success: true,
      surveyId,
      totalResponses: validResponses.length,
      message: 'Survey uploaded successfully. AI analysis in progress...'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
