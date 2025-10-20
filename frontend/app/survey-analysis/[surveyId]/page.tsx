"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Tag, Lightbulb, MessageSquare, Loader2, TrendingUp, TrendingDown, Users, BarChart3, Download, Share2 } from "lucide-react";
import Link from 'next/link';

interface SurveyAnalysisData {
  survey: {
    id: string;
    survey_name: string;
    total_responses: number;
    upload_date: string;
    status: string;
  };
  themes: {
    id: string;
    theme_name: string;
    mention_count: number;
    sentiment_score: number;
    sample_responses: string[];
  }[];
  insights: {
    id: string;
    insight_type: string;
    title: string;
    description: string;
    priority: number;
    supporting_data: any;
  }[];
  sampleResponses: {
    id: string;
    response_text: string;
    sentiment_score: number;
    sentiment_label: string;
    themes: string[];
  }[];
}

export default function SurveyAnalysisDetailPage() {
  const params = useParams();
  const surveyId = params.surveyId as string;
  const [analysisData, setAnalysisData] = useState<SurveyAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalysisData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/survey-analysis/details?surveyId=${surveyId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch survey analysis details');
        }
        const data: SurveyAnalysisData = await response.json();
        setAnalysisData(data);
      } catch (err: any) {
        console.error("Error fetching survey analysis details:", err);
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    }

    if (surveyId) {
      fetchAnalysisData();
    }
  }, [surveyId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-lg text-muted-foreground">Loading survey analysis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-red-600">
        <p className="text-lg">Error: {error}</p>
        <Button asChild className="mt-4">
          <Link href="/survey-analysis">Go back to Survey Upload</Link>
        </Button>
      </div>
    );
  }

  if (!analysisData || !analysisData.survey) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-lg text-muted-foreground">No analysis data found for this survey.</p>
        <Button asChild className="mt-4">
          <Link href="/survey-analysis">Go back to Survey Upload</Link>
        </Button>
      </div>
    );
  }

  const { survey, themes, insights, sampleResponses } = analysisData;

  // Calculate sentiment distribution
  const sentimentCounts = sampleResponses.reduce((acc, response) => {
    acc[response.sentiment_label] = (acc[response.sentiment_label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get top themes
  const topThemes = themes.slice(0, 10);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <Brain className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold">Survey Analysis: {survey.survey_name}</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          AI-powered insights from {survey.total_responses} responses • Uploaded {new Date(survey.upload_date).toLocaleDateString()}
        </p>
        <div className="flex items-center justify-center space-x-4">
          <Badge variant="outline" className="text-green-600 border-green-600">
            Status: {survey.status}
          </Badge>
        </div>
      </div>

      {/* Summary Cards (+ Sentiment Overview condensed) */}
      <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Total Responses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-blue-600">{survey.total_responses}</p>
            <p className="text-sm text-muted-foreground">Survey responses analyzed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-purple-600" />
              Themes Identified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-purple-600">{themes.length}</p>
            <p className="text-sm text-muted-foreground">Key themes discovered</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-green-600" />
              Insights Generated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-green-600">{insights.length}</p>
            <p className="text-sm text-muted-foreground">Actionable insights</p>
          </CardContent>
        </Card>
        {/* Condensed Sentiment Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Sentiment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              {(['positive','neutral','negative'] as const).map((sent) => (
                <div key={sent} className="p-2 border rounded">
                  <div className={`text-xl font-bold ${
                    sent === 'positive' ? 'text-green-600' : sent === 'negative' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {sentimentCounts[sent] || 0}
                  </div>
                  <div className="text-xs capitalize text-muted-foreground">{sent}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <Button className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Download Report
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Share Results
        </Button>
      </div>

      {/* Removed large Sentiment section (now condensed above) */}

      {/* Top Themes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-6 w-6 text-purple-600" />
            Top Themes
          </CardTitle>
          <CardDescription>Most frequently mentioned themes in your survey responses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {topThemes.map((theme, index) => (
              <div key={theme.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">{theme.theme_name}</h4>
                  <Badge variant="secondary">#{index + 1}</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Mentions:</span>
                    <span className="font-medium">{theme.mention_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sentiment:</span>
                    <div className="flex items-center gap-1">
                      {theme.sentiment_score > 0.6 ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : theme.sentiment_score < 0.4 ? (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-yellow-600" />
                      )}
                      <span className="font-medium">
                        {theme.sentiment_score > 0.6 ? 'Positive' : 
                         theme.sentiment_score < 0.4 ? 'Negative' : 'Neutral'}
                      </span>
                    </div>
                  </div>
                  {theme.sample_responses && theme.sample_responses.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <div className="font-medium mb-1">Sample responses:</div>
                      <div className="space-y-1">
                        {theme.sample_responses.slice(0, 2).map((response, idx) => (
                          <div key={idx} className="truncate italic">"{response}"</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-yellow-600" />
              Key Insights
            </CardTitle>
            <CardDescription>Clear, actionable insights from your survey responses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {insights.map((insight, index) => (
                <div key={insight.id} className="border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-lg">{insight.title}</h4>
                    <Badge variant={insight.priority >= 8 ? "destructive" : "secondary"}>
                      Priority: {insight.priority}/10
                    </Badge>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-line text-sm leading-relaxed">
                      {insight.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sample Responses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            Sample Responses
          </CardTitle>
          <CardDescription>Examples of actual feedback from your survey</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sampleResponses.slice(0, 5).map((response) => (
              <div key={response.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      response.sentiment_label === 'positive' ? 'default' :
                      response.sentiment_label === 'negative' ? 'destructive' :
                      'secondary'
                    }>
                      {response.sentiment_label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Score: {response.sentiment_score.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="text-sm mb-2">"{response.response_text}"</p>
                {response.themes && response.themes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {response.themes.map((theme, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}