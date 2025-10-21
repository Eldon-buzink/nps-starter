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

    // Detect survey structure
    const isMultiQuestion = headers.length > 2; // More than just participant_id and one response column
    const questionColumns = headers.filter(header => 
      header.toLowerCase().includes('question') || 
      header.toLowerCase().includes('response') ||
      header.toLowerCase().includes('feedback') ||
      header.toLowerCase().includes('comment')
    );
    
    // If no obvious question columns, assume all columns except participant_id are questions
    const responseColumns = questionColumns.length > 0 ? questionColumns : headers.filter(h => h !== 'participant_id');
    
    console.log('Survey structure detected:', {
      isMultiQuestion,
      totalColumns: headers.length,
      responseColumns: responseColumns.length,
      columns: responseColumns
    });

    // For multi-question surveys, we'll process all response columns
    // For single-question surveys, find the main response column
    let mainResponseColumn = responseColumns[0]; // Default to first response column
    
    if (!isMultiQuestion) {
      // Single question - find the main response column
      const singleResponseColumn = headers.find(header => 
        header.toLowerCase().includes('response') ||
        header.toLowerCase().includes('comment') ||
        header.toLowerCase().includes('feedback') ||
        header.toLowerCase().includes('answer') ||
        header.toLowerCase().includes('text')
      );
      
      if (singleResponseColumn) {
        mainResponseColumn = singleResponseColumn;
      }
    }

    // Filter out empty responses across all response columns
    const validResponses = dataRows.filter(row => 
      responseColumns.some(col => row[col] && row[col].trim().length > 10)
    );

    if (validResponses.length === 0) {
      return NextResponse.json({ 
        error: 'No valid responses found. Please ensure your response columns contain meaningful text.' 
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
        response_column: mainResponseColumn,
        headers: headers,
        question_columns: responseColumns,
        is_multi_question: isMultiQuestion,
        status: 'processing'
      });

    if (surveyError) {
      console.error('Error storing survey metadata:', surveyError);
      return NextResponse.json({ error: 'Failed to store survey data' }, { status: 500 });
    }

    // Store individual responses
    let responses = [];
    
    if (isMultiQuestion) {
      // Multi-question: create separate response records for each question
      validResponses.forEach((row, participantIndex) => {
        responseColumns.forEach((questionColumn, questionIndex) => {
          if (row[questionColumn] && row[questionColumn].trim().length > 10) {
            responses.push({
              survey_id: surveyId,
              response_id: uuidv4(),
              row_number: participantIndex + 2,
              response_text: row[questionColumn],
              question_text: questionColumn,
              question_order: questionIndex,
              participant_id: row.participant_id || `P${participantIndex + 1}`,
              metadata: Object.fromEntries(
                Object.entries(row).filter(([key, value]) => 
                  !responseColumns.includes(key) && value
                )
              )
            });
          }
        });
      });
    } else {
      // Single question: original logic
      responses = validResponses.map((row, index) => ({
        survey_id: surveyId,
        response_id: uuidv4(),
        row_number: index + 2,
        response_text: row[mainResponseColumn],
        question_text: mainResponseColumn,
        question_order: 0,
        participant_id: row.participant_id || `P${index + 1}`,
        metadata: Object.fromEntries(
          Object.entries(row).filter(([key, value]) => key !== mainResponseColumn && value)
        )
      }));
    }

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
