"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Tag, Lightbulb, MessageSquare, Loader2, TrendingUp, TrendingDown, Users, BarChart3, Download, Share2 } from "lucide-react";
import CollapsibleSurveyThemes from "@/components/CollapsibleSurveyThemes";
import Link from 'next/link';

// Multi-question insights component
function MultiQuestionInsights({ insights, survey }: { insights: any[], survey: any }) {
  // Group insights by question
  const questionInsights = insights.filter(insight => 
    insight.title.includes('Question Analysis:')
  );
  
  const overallInsights = insights.filter(insight => 
    !insight.title.includes('Question Analysis:')
  );

  // Clean up question names for display
  const cleanQuestionName = (questionText: string) => {
    return questionText
      .replace('question_1_', '')
      .replace('question_2_', '')
      .replace('question_3_', '')
      .replace('question_4_', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-8">
      {/* Overall insights first */}
      {overallInsights.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Overall Survey Analysis</h3>
          <div className="grid gap-4">
            {overallInsights.map((insight, index) => (
              <Card key={index} className="border-purple-200 bg-purple-50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-2xl">📊</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-lg">{insight.title}</h4>
                        <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
                          Priority: {insight.priority}/10
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-700 whitespace-pre-line">
                        {insight.description}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Per-question insights */}
      {questionInsights.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-900">Question-by-Question Analysis</h3>
          <div className="grid gap-6">
            {questionInsights.map((insight, index) => {
              const questionName = insight.title.replace('Question Analysis: ', '');
              const cleanName = cleanQuestionName(questionName);
              
              return (
                <Card key={index} className="border-blue-200 bg-blue-50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="text-2xl">❓</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-lg">{cleanName}</h4>
                          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                            Priority: {insight.priority}/10
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-line">
                          {insight.description}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface SurveyAnalysisData {
  survey: {
    id: string;
    survey_name: string;
    total_responses: number;
    upload_date: string;
    status: string;
    is_multi_question?: boolean;
    question_columns?: string[];
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold mb-2">Loading Survey Analysis</h2>
              <p className="text-muted-foreground">Preparing your insights and recommendations...</p>
            </div>
          </div>
        </div>
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

  // Parse action plan content into structured components
  function parseActionPlan(content: string) {
    const sections = content.split(/\*\*\d+\.\s+/).slice(1); // Remove intro text and split by numbered sections
    
    return sections.map((section, index) => {
      const lines = section.split('\n').filter(line => line.trim());
      const title = lines[0]?.replace(/\*\*/g, '').trim() || `Section ${index + 1}`;
      
      // Extract metrics, feedback, and actions
      const metrics = lines.find(line => line.includes('Mentioned by'))?.trim() || '';
      const positiveFeedback = lines.find(line => line.includes('What customers love:'))?.replace('• What customers love: ', '').trim() || '';
      const issueReported = lines.find(line => line.includes('Issues to address:'))?.replace('• Issues to address: ', '').trim() || '';
      const action = lines.find(line => line.includes('Action:'))?.replace('• Action: ', '').trim() || '';
      const whyMatters = lines.find(line => line.includes('Why this matters:'))?.replace('• Why this matters: ', '').trim() || '';
      
      return (
        <div key={index} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <h4 className="font-semibold text-lg text-gray-900">{title}</h4>
            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
              #{index + 1}
            </Badge>
          </div>
          
          <div className="space-y-4">
            {/* Metrics */}
            {metrics && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="h-4 w-4 text-blue-500" />
                <span>{metrics}</span>
              </div>
            )}
            
            {/* Positive Feedback */}
            {positiveFeedback && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-green-600 mt-0.5">✅</div>
                  <div>
                    <div className="font-medium text-green-800 text-sm mb-1">Positive Feedback</div>
                    <blockquote className="text-sm text-green-700 italic">"{positiveFeedback}"</blockquote>
                  </div>
                </div>
              </div>
            )}
            
            {/* Issue Reported */}
            {issueReported && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-red-600 mt-0.5">⚠️</div>
                  <div>
                    <div className="font-medium text-red-800 text-sm mb-1">Issue Reported</div>
                    <blockquote className="text-sm text-red-700 italic">"{issueReported}"</blockquote>
                  </div>
                </div>
              </div>
            )}
            
            {/* Action */}
            {action && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-blue-600 mt-0.5">🎯</div>
                  <div>
                    <div className="font-medium text-blue-800 text-sm mb-1">Recommended Action</div>
                    <div className="text-sm text-blue-700">{action}</div>
                  </div>
                </div>
              </div>
            )}
            
            {whyMatters && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-green-600 mt-0.5">💡</div>
                  <div>
                    <div className="font-medium text-green-800 text-sm mb-1">Why this matters</div>
                    <div className="text-sm text-green-700">{whyMatters}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    });
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 rounded-2xl p-8 mb-8">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative text-center space-y-6">
          <div className="flex items-center justify-center space-x-4">
            <div className="p-3 bg-white rounded-full shadow-lg">
              <Brain className="h-8 w-8 text-purple-600" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Survey Analysis Results
              </h1>
              <p className="text-lg text-gray-600 mt-1">{survey.survey_name}</p>
            </div>
          </div>
          <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>{survey.total_responses} responses analyzed</span>
            </div>
            <div className="flex items-center space-x-2">
              <Tag className="h-4 w-4" />
              <span>{themes.length} themes identified</span>
            </div>
            <div className="flex items-center space-x-2">
              <Lightbulb className="h-4 w-4" />
              <span>{insights.length} insights generated</span>
            </div>
          </div>
          <div className="flex items-center justify-center space-x-4">
            <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">
              Status: {survey.status}
            </Badge>
            <span className="text-sm text-gray-500">
              Uploaded {new Date(survey.upload_date).toLocaleDateString()}
            </span>
          </div>
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

      {/* Survey Insights - Moved above themes */}
      {insights.length > 0 && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Key Insights & Recommendations</h2>
            <p className="text-muted-foreground">Evidence-based insights for your team</p>
          </div>
          
          {/* Multi-question survey layout */}
          {survey.is_multi_question ? (
            <MultiQuestionInsights insights={insights} survey={survey} />
          ) : (
            <div className="grid gap-6">
              {insights
                .filter(insight => insight.insight_type !== 'theme') // Remove individual theme analysis cards
                .map((insight, index) => {
              const getCardStyle = (type: string) => {
                switch (type) {
                  case 'theme':
                    return 'border-blue-200 bg-blue-50';
                  case 'summary':
                    return 'border-purple-200 bg-purple-50';
                  case 'recommendation':
                    return 'border-green-200 bg-green-50';
                  default:
                    return 'border-gray-200 bg-gray-50';
                }
              };

              const getIcon = (type: string) => {
                switch (type) {
                  case 'theme':
                    return '📊';
                  case 'summary':
                    return '📈';
                  case 'recommendation':
                    return '🎯';
                  default:
                    return '💡';
                }
              };

              // Special handling for Team Action Plan to parse structured content
              if (insight.title === 'Team Action Plan' && insight.description.includes('**1.')) {
                return (
                  <div key={insight.id} className="space-y-6">
                    {/* Parse and display structured action plan as individual cards */}
                    {parseActionPlan(insight.description)}
                  </div>
                );
              }

              return (
                <Card key={insight.id} className={`${getCardStyle(insight.insight_type)}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="text-2xl">{getIcon(insight.insight_type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg">{insight.title}</h3>
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
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Themes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-6 w-6 text-purple-600" />
            Key Themes Identified
          </CardTitle>
          <CardDescription>Most frequently mentioned themes in your survey responses</CardDescription>
        </CardHeader>
        <CardContent>
          <CollapsibleSurveyThemes themes={topThemes} maxVisible={5} />
        </CardContent>
      </Card>

      {/* Sample Responses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            Sample Feedback
          </CardTitle>
          <CardDescription>Examples of actual responses from your survey</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sampleResponses.slice(0, 5).map((response) => (
              <div key={response.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      response.sentiment_label === 'positive' ? 'default' :
                      response.sentiment_label === 'negative' ? 'destructive' :
                      'secondary'
                    }>
                      {response.sentiment_label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Sentiment: {response.sentiment_score.toFixed(2)}
                    </span>
                  </div>
                </div>
                <blockquote className="text-sm mb-3 italic text-gray-700 leading-relaxed">
                  "{response.response_text}"
                </blockquote>
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