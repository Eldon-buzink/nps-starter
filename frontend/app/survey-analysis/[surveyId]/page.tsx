"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Tag, Lightbulb, MessageSquare, Loader2, TrendingUp, TrendingDown, Users, BarChart3, Download, Share2 } from "lucide-react";
import CollapsibleSurveyThemes from "@/components/CollapsibleSurveyThemes";
import Link from 'next/link';

interface SurveyAnalysisData {
  survey: {
    id: string;
    survey_name: string;
    total_responses: number;
    upload_date: string;
    is_multi_question: boolean;
    question_columns: string[];
  };
  themes: {
    id: string;
    theme_name: string;
    mention_count: number;
    average_sentiment_score: number;
    sentiment_label: string;
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

  // Multi-question insights component
  const MultiQuestionInsights = ({ insights, survey }: { insights: any[], survey: any }) => {
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
        {Object.entries(questionGroups).map(([questionText, questionInsights]) => (
          <div key={questionText} className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">{questionText}</h3>
            <div className="grid gap-4">
              {questionInsights.map((insight, index) => (
                <Card key={index} className="border-blue-200 bg-blue-50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="text-2xl">❓</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-lg">{insight.title}</h4>
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
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Parse action plan content into structured components
  const parseActionPlan = (content: string) => {
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
  };

  // Calculate sentiment distribution
  const sentimentCounts = sampleResponses.reduce((acc, response) => {
    acc[response.sentiment_label] = (acc[response.sentiment_label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get top themes
  const topThemes = themes.slice(0, 10);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 rounded-2xl p-8 mb-8">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative text-center space-y-6">
          <div className="flex items-center justify-center space-x-4">
            <div className="p-3 bg-white rounded-full shadow-lg">
              <Brain className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Survey Analysis Results
              </h1>
              <p className="text-lg text-gray-600 mt-2">
                AI-powered insights and recommendations from your survey data
              </p>
            </div>
          </div>
          
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-center space-x-3">
                <MessageSquare className="h-6 w-6 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold text-gray-900">{survey.total_responses}</div>
                  <div className="text-sm text-gray-600">Responses Analyzed</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-center space-x-3">
                <Tag className="h-6 w-6 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-gray-900">{themes.length}</div>
                  <div className="text-sm text-gray-600">Themes Identified</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-center space-x-3">
                <Lightbulb className="h-6 w-6 text-purple-600" />
                <div>
                  <div className="text-2xl font-bold text-gray-900">{insights.length}</div>
                  <div className="text-sm text-gray-600">Insights Generated</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge className="bg-green-100 text-green-800 border-green-200 px-4 py-2 text-sm font-medium">
              ✅ Analysis Complete
            </Badge>
          </div>
        </div>
      </div>

      {/* Key Insights & Recommendations */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Lightbulb className="h-6 w-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-900">Key Insights & Recommendations</h2>
        </div>
        
        {survey.is_multi_question ? (
          <div className="grid gap-6">
            {Object.entries(questionGroups).map(([questionText, questionInsights]) => {
              // Calculate sentiment for this question
              const questionResponses = sampleResponses.filter(r => r.question_text === questionText);
              const sentimentCounts = questionResponses.reduce((acc, response) => {
                acc[response.sentiment_label] = (acc[response.sentiment_label] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              
              const totalResponses = Object.values(sentimentCounts).reduce((sum, count) => sum + count, 0);
              const positiveCount = sentimentCounts['positive'] || 0;
              const negativeCount = sentimentCounts['negative'] || 0;
              const neutralCount = sentimentCounts['neutral'] || 0;
              
              const positivePercentage = totalResponses > 0 ? (positiveCount / totalResponses) * 100 : 0;
              const negativePercentage = totalResponses > 0 ? (negativeCount / totalResponses) * 100 : 0;
              
              // Get themes for this question
              const questionThemes = themes.filter(theme => 
                theme.related_questions?.includes(questionText) || 
                questionResponses.some(r => r.themes?.includes(theme.theme_name))
              );
              
              return (
                <Card key={questionText} className="border border-gray-200 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                      </div>
                      {questionText}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Sentiment Overview */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{positiveCount}</div>
                        <div className="text-sm text-green-700">Positive ({positivePercentage.toFixed(0)}%)</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{negativeCount}</div>
                        <div className="text-sm text-red-700">Negative ({negativePercentage.toFixed(0)}%)</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-600">{neutralCount}</div>
                        <div className="text-sm text-gray-700">Neutral</div>
                      </div>
                    </div>
                    
                    {/* Key Themes */}
                    {questionThemes.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <Tag className="h-4 w-4 text-blue-600" />
                          Key Themes
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {questionThemes.slice(0, 5).map(theme => (
                            <Badge key={theme.id} variant="secondary" className="text-sm">
                              {theme.theme_name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Sample Feedback */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                        Sample Feedback
                      </h4>
                      <div className="space-y-2">
                        {questionResponses.slice(0, 3).map(response => (
                          <div key={response.id} className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700 italic">"{response.response_text}"</p>
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant={response.sentiment_label === 'positive' ? 'success' : response.sentiment_label === 'negative' ? 'destructive' : 'secondary'}>
                                {response.sentiment_label}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-6">
            {insights.map((insight) => (
              insight.title === 'Team Action Plan' && insight.description.includes('**1.') ? (
                // Special handling for Team Action Plan - no card wrapper, just the action items
                <div key={insight.id} className="space-y-4">
                  {parseActionPlan(insight.description)}
                </div>
              ) : (
                <Card key={insight.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-blue-600" />
                      {insight.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      {insight.description.split('\n').map((line, index) => (
                        <p key={index} className="mb-2 last:mb-0">
                          {line}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            ))}
          </div>
        )}
      </div>

      {/* Key Themes Identified */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Tag className="h-6 w-6 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-900">Key Themes Identified</h2>
        </div>
        
        <CollapsibleSurveyThemes themes={themes} />
      </div>

      {/* Sample Feedback */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <MessageSquare className="h-6 w-6 text-orange-600" />
          <h2 className="text-2xl font-bold text-gray-900">Sample Feedback</h2>
        </div>
        
        <div className="grid gap-4">
          {sampleResponses.slice(0, 5).map((response, index) => (
            <Card key={response.id} className="border-l-4 border-l-orange-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant="outline" 
                      className={`${
                        response.sentiment_label === 'positive' 
                          ? 'text-green-600 border-green-200 bg-green-50' 
                          : response.sentiment_label === 'negative'
                          ? 'text-red-600 border-red-200 bg-red-50'
                          : 'text-gray-600 border-gray-200 bg-gray-50'
                      }`}
                    >
                      {response.sentiment_label}
                    </Badge>
                    <span className="text-sm text-gray-500">Response #{index + 1}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Score: {response.sentiment_score.toFixed(1)}
                  </div>
                </div>
                
                <blockquote className="text-gray-700 italic mb-3">
                  "{response.response_text}"
                </blockquote>
                
                {response.themes && response.themes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {response.themes.map((theme, themeIndex) => (
                      <Badge key={themeIndex} variant="secondary" className="text-xs">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}