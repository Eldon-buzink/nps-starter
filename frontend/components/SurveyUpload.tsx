"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, AlertCircle, X, Brain, Loader2, BarChart3, Users, Lightbulb } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SurveyUploadProps {
  onUploadComplete: (surveyId: string) => void;
}

interface ProcessingStatus {
  survey: {
    id: string;
    name: string;
    status: string;
    total_responses: number;
    upload_date: string;
  };
  progress: {
    processed: number;
    total: number;
    percentage: number;
  };
  results: {
    themes: number;
    insights: number;
  };
}

export function SurveyUpload({ onUploadComplete }: SurveyUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [currentSurveyId, setCurrentSurveyId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll processing status when in processing mode
  useEffect(() => {
    if (uploadStatus === 'processing' && currentSurveyId) {
      const checkStatus = async () => {
        try {
          const response = await fetch(`/api/survey-analysis/status?surveyId=${currentSurveyId}`);
          if (response.ok) {
            const data = await response.json();
            setProcessingStatus(data);
            
            // If processing is complete, redirect to results
            if (data.survey.status === 'completed') {
              onUploadComplete(currentSurveyId);
            }
          }
        } catch (err) {
          console.error('Failed to check processing status:', err);
        }
      };

      // Check status immediately
      checkStatus();
      
      // Poll every 2 seconds
      const interval = setInterval(checkStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [uploadStatus, currentSurveyId, onUploadComplete]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      setError('Please upload a CSV or Excel file');
      setUploadStatus('error');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      setUploadStatus('error');
      return;
    }

    setIsUploading(true);
    setUploadStatus('uploading');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('surveyName', file.name.replace('.csv', ''));
      formData.append('responseColumn', 'response_text'); // Default column name

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 20;
        });
      }, 200);

      const response = await fetch('/api/survey-analysis/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      setCurrentSurveyId(result.surveyId);
      setUploadStatus('processing');

    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      setFileName(file.name);
      handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const resetUpload = () => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setError(null);
    setFileName(null);
    setCurrentSurveyId(null);
    setProcessingStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>Upload Your Survey Data</span>
        </CardTitle>
        <CardDescription>
          Upload a CSV file with your survey responses to get started with AI analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            uploadStatus === 'idle' 
              ? 'border-gray-300 hover:border-blue-400' 
              : uploadStatus === 'success'
              ? 'border-green-300 bg-green-50'
              : uploadStatus === 'error'
              ? 'border-red-300 bg-red-50'
              : 'border-blue-300 bg-blue-50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {uploadStatus === 'idle' && (
            <>
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Drop your CSV file here</h3>
              <p className="text-sm text-gray-500 mb-4">
                or click to browse files
              </p>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </>
          )}

          {uploadStatus === 'uploading' && (
            <>
              <FileText className="h-12 w-12 mx-auto text-blue-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">Uploading {fileName}...</h3>
              <Progress value={uploadProgress} className="mb-4" />
              <p className="text-sm text-gray-500">{Math.round(uploadProgress)}% complete</p>
            </>
          )}

          {uploadStatus === 'processing' && (
            <>
              <Brain className="h-12 w-12 mx-auto text-blue-500 mb-4" />
              <h3 className="text-lg font-medium mb-2 text-blue-700">Processing Your Survey</h3>
              <p className="text-sm text-blue-600 mb-4">
                AI is analyzing your survey responses to extract insights and themes
              </p>
              {processingStatus && (
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Processing responses...</span>
                      <span>{processingStatus.progress.percentage || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${processingStatus.progress.percentage || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <Users className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                      <div className="text-lg font-bold text-blue-600">{processingStatus.survey.total_responses}</div>
                      <div className="text-xs text-muted-foreground">Responses</div>
                    </div>
                    
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <BarChart3 className="h-5 w-5 mx-auto text-purple-600 mb-1" />
                      <div className="text-lg font-bold text-purple-600">{processingStatus.results.themes}</div>
                      <div className="text-xs text-muted-foreground">Themes</div>
                    </div>
                    
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <Lightbulb className="h-5 w-5 mx-auto text-green-600 mb-1" />
                      <div className="text-lg font-bold text-green-600">{processingStatus.results.insights}</div>
                      <div className="text-xs text-muted-foreground">Insights</div>
                    </div>
                    
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-lg font-bold text-orange-600">{processingStatus.progress.percentage || 0}%</div>
                      <div className="text-xs text-muted-foreground">Complete</div>
                    </div>
                  </div>

                  {/* Processing Steps */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Processing Steps:</h4>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Upload completed</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        {processingStatus.results.themes > 0 ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        )}
                        <span>AI theme analysis</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        {processingStatus.results.insights > 0 ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        )}
                        <span>Generating insights</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span>Finalizing results</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {uploadStatus === 'error' && (
            <>
              <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
              <h3 className="text-lg font-medium mb-2 text-red-700">Upload Failed</h3>
              <p className="text-sm text-red-600 mb-4">
                {error || 'An error occurred during upload'}
              </p>
              <Button onClick={resetUpload} variant="outline">
                Try Again
              </Button>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Error Alert */}
        {error && uploadStatus === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* CSV Format Requirements */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Include a column with open-ended responses (e.g., "comments", "feedback", "response")</li>
            <li>• Optional: Include columns for ratings, dates, demographics</li>
            <li>• First row should contain column headers</li>
            <li>• Maximum file size: 10MB</li>
          </ul>
        </div>

        {/* Reset Button */}
        {uploadStatus !== 'idle' && uploadStatus !== 'uploading' && (
          <div className="text-center">
            <Button onClick={resetUpload} variant="outline">
              <X className="h-4 w-4 mr-2" />
              Upload Another File
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
