"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileText, Brain, BarChart3, Download, Share2, Clock, CheckCircle, TrendingUp, Users, MessageSquare } from "lucide-react";

interface SurveyAnalysisPageProps {
  params: {
    surveyId: string;
  };
}

interface SurveyStatus {
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

export default function SurveyAnalysisPage({ params }: SurveyAnalysisPageProps) {
  const { surveyId } = params;
  const [status, setStatus] = useState<SurveyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/survey-analysis/status?surveyId=${surveyId}`);
        const data = await response.json();
        setStatus(data);
        setLoading(false);
      } catch (error) {
        console.error('Error checking status:', error);
        setLoading(false);
      }
    };

    checkStatus();
    
    // Poll every 3 seconds if still processing
    const interval = setInterval(() => {
      if (status?.survey.status === 'processing') {
        checkStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [surveyId, status?.survey.status]);

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/survey-analysis/status?surveyId=${surveyId}`);
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Unable to load survey status</p>
            <Button onClick={handleCheckStatus} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status.survey.status === 'processing') {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <FileText className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Survey Analysis</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            AI-powered insights from your survey data
          </p>
        </div>

        {/* Analysis in Progress */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Clock className="h-6 w-6 text-orange-500" />
              <CardTitle className="text-xl">Analysis in Progress</CardTitle>
            </div>
            <CardDescription>
              Your survey data is being processed with AI analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{status.progress.percentage}%</span>
              </div>
              <Progress value={status.progress.percentage} className="w-full" />
              <div className="text-center text-sm text-muted-foreground">
                {status.progress.processed} of {status.progress.total} responses processed
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">What's happening:</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Analyzing response themes and patterns</li>
                <li>• Calculating sentiment scores</li>
                <li>• Generating key insights and recommendations</li>
                <li>• Creating visual summaries</li>
              </ul>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              This usually takes 1-2 minutes depending on the size of your survey
            </div>

            <div className="flex justify-center">
              <Button onClick={handleCheckStatus} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                <CheckCircle className="h-4 w-4 mr-2" />
                {loading ? 'Checking...' : 'Check Status'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Analysis completed - show results
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <FileText className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold">Survey Analysis Complete</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          AI-powered insights from your survey data
        </p>
      </div>

      {/* Results Summary */}
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Total Responses
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {status.survey.total_responses}
            </div>
            <p className="text-sm text-muted-foreground">Survey responses analyzed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Themes Identified
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {status.results.themes}
            </div>
            <p className="text-sm text-muted-foreground">Key themes discovered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Insights Generated
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {status.results.insights}
            </div>
            <p className="text-sm text-muted-foreground">Actionable insights</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
        <Button variant="outline">
          <Share2 className="h-4 w-4 mr-2" />
          Share Results
        </Button>
      </div>
    </div>
  );
}