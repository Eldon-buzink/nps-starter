"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, CheckCircle, AlertCircle, BarChart3, Users, Lightbulb } from "lucide-react";

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

export default function SurveyProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.surveyId as string;
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/survey-analysis/status?surveyId=${surveyId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        const data = await response.json();
        setStatus(data);
        setLoading(false);

        // If processing is complete, redirect to results
        if (data.survey.status === 'completed') {
          router.push(`/survey-analysis/${surveyId}`);
        }
      } catch (err) {
        setError('Failed to check processing status');
        setLoading(false);
      }
    };

    // Check status immediately
    checkStatus();

    // Poll every 2 seconds while processing
    const interval = setInterval(checkStatus, 2000);

    return () => clearInterval(interval);
  }, [surveyId, router]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <p className="text-muted-foreground">Loading processing status...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <AlertCircle className="h-8 w-8 mx-auto text-red-600" />
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const isProcessing = status.survey.status === 'processing';
  const progressPercentage = status.progress.percentage || 0;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <Brain className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Processing Your Survey</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          AI is analyzing your survey responses to extract insights and themes
        </p>
      </div>

      {/* Processing Status Card */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
              <span>{status.survey.name}</span>
            </CardTitle>
            <Badge variant={isProcessing ? "default" : "secondary"}>
              {isProcessing ? "Processing" : "Completed"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Processing responses...</span>
                <span>{progressPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Status Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Users className="h-6 w-6 mx-auto text-blue-600 mb-2" />
              <div className="text-2xl font-bold text-blue-600">{status.survey.total_responses}</div>
              <div className="text-sm text-muted-foreground">Responses</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <BarChart3 className="h-6 w-6 mx-auto text-purple-600 mb-2" />
              <div className="text-2xl font-bold text-purple-600">{status.results.themes}</div>
              <div className="text-sm text-muted-foreground">Themes</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Lightbulb className="h-6 w-6 mx-auto text-green-600 mb-2" />
              <div className="text-2xl font-bold text-green-600">{status.results.insights}</div>
              <div className="text-sm text-muted-foreground">Insights</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{progressPercentage}%</div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </div>
          </div>

          {/* Processing Steps */}
          {isProcessing && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">Processing Steps:</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Upload completed</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  {status.results.themes > 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  )}
                  <span>AI theme analysis</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  {status.results.insights > 0 ? (
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
          )}

          {/* Completion Message */}
          {!isProcessing && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-green-600">Analysis Complete!</h3>
                <p className="text-muted-foreground">Redirecting to your results...</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Tips */}
      {isProcessing && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-lg">What's happening?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>• Our AI is reading through each response to understand sentiment and themes</p>
              <p>• Themes are being identified and grouped by similarity</p>
              <p>• Actionable insights are being generated based on the data patterns</p>
              <p>• This usually takes 30-60 seconds depending on the number of responses</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
