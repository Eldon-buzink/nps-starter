import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, TrendingDown, Target, Lightbulb, Users, MessageSquare } from "lucide-react";

interface ThemeSummaryProps {
  theme: string;
  kpis: {
    current_nps: number;
    total_responses: number;
    promoters: number;
    passives: number;
    detractors: number;
    avg_score: number;
  };
  titles: Array<{
    title: string;
    total: number;
    nps: number;
    avg_score: number;
    promoters: number;
    detractors: number;
  }>;
  keyInsights: Array<{
    word: string;
    count: number;
  }>;
  promoterResponses: Array<{
    nps_score: number;
    nps_explanation: string;
    title_text: string;
  }>;
  detractorResponses: Array<{
    nps_score: number;
    nps_explanation: string;
    title_text: string;
  }>;
}

export default function ThemeSummary({ 
  theme, 
  kpis, 
  titles, 
  keyInsights, 
  promoterResponses, 
  detractorResponses 
}: ThemeSummaryProps) {
  
  // Calculate impact metrics
  const detractorPercentage = kpis.total_responses > 0 ? (kpis.detractors / kpis.total_responses) * 100 : 0;
  const promoterPercentage = kpis.total_responses > 0 ? (kpis.promoters / kpis.total_responses) * 100 : 0;
  
  // Get top affected titles
  const topAffectedTitles = titles.slice(0, 3);
  
  // Determine priority level
  const getPriorityLevel = () => {
    if (kpis.current_nps < -20 || detractorPercentage > 60) return 'critical';
    if (kpis.current_nps < 0 || detractorPercentage > 40) return 'high';
    if (kpis.current_nps < 20 || detractorPercentage > 25) return 'medium';
    return 'low';
  };
  
  const priorityLevel = getPriorityLevel();
  const priorityColors = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200'
  };
  
  // Generate actionable insights based on theme
  const getActionableInsights = () => {
    const insights = [];
    
    // Impact-based insights
    if (detractorPercentage > 50) {
      insights.push({
        type: 'impact',
        title: 'High Detractor Impact',
        description: `${detractorPercentage.toFixed(1)}% of responses are detractors`,
        action: 'Focus on reducing negative sentiment through targeted improvements',
        reasoning: 'High detractor percentage indicates systemic issues that need immediate attention'
      });
    }
    
    // Title-specific insights
    if (topAffectedTitles.length > 0) {
      const topTitle = topAffectedTitles[0];
      insights.push({
        type: 'scope',
        title: 'Most Affected Title',
        description: `${topTitle.title} has ${topTitle.total} mentions with ${topTitle.nps.toFixed(1)} NPS`,
        action: `Prioritize improvements for ${topTitle.title} - highest volume of feedback`,
        reasoning: 'Addressing the most affected title will have the biggest impact on overall theme performance'
      });
    }
    
    // Content-specific insights based on key words
    if (keyInsights.length > 0) {
      const topWords = keyInsights.slice(0, 3).map(k => k.word).join(', ');
      insights.push({
        type: 'content',
        title: 'Key Topics',
        description: `Most mentioned: ${topWords}`,
        action: `Focus content strategy around: ${topWords}`,
        reasoning: 'These are the specific areas customers mention most frequently'
      });
    }
    
    // NPS-based insights
    if (kpis.current_nps < 0) {
      insights.push({
        type: 'nps',
        title: 'Negative NPS',
        description: `Current NPS: ${kpis.current_nps.toFixed(1)} (${kpis.detractors} detractors vs ${kpis.promoters} promoters)`,
        action: 'Implement customer recovery program and address root causes',
        reasoning: 'Negative NPS means more customers are actively dissatisfied than satisfied'
      });
    }
    
    return insights;
  };
  
  const actionableInsights = getActionableInsights();
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Executive Summary: {theme.replace('_', ' ')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Priority & Impact */}
        <div className="flex items-center gap-4">
          <Badge className={`${priorityColors[priorityLevel]} border`}>
            {priorityLevel.toUpperCase()} PRIORITY
          </Badge>
          <div className="text-sm text-muted-foreground">
            {kpis.total_responses} total responses • {detractorPercentage.toFixed(1)}% detractors
          </div>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{kpis.current_nps.toFixed(1)}</div>
            <div className="text-sm text-gray-600">NPS Score</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{kpis.detractors}</div>
            <div className="text-sm text-gray-600">Detractors</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{kpis.promoters}</div>
            <div className="text-sm text-gray-600">Promoters</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">{kpis.avg_score.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Avg Score</div>
          </div>
        </div>
        
        {/* Top Affected Titles */}
        {topAffectedTitles.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Most Affected Titles
            </h4>
            <div className="space-y-2">
              {topAffectedTitles.map((title, index) => (
                <div key={title.title} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="font-medium">{title.title}</span>
                  <div className="flex gap-4 text-sm">
                    <span>{title.total} mentions</span>
                    <span className={`font-medium ${title.nps < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {title.nps.toFixed(1)} NPS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Actionable Insights */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Actionable Insights
          </h4>
          <div className="space-y-3">
            {actionableInsights.map((insight, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="font-medium text-blue-900">{insight.title}</h5>
                    <p className="text-sm text-gray-700 mt-1">{insight.description}</p>
                    <div className="mt-2 p-2 bg-blue-50 rounded">
                      <p className="text-sm font-medium text-blue-800">Recommended Action:</p>
                      <p className="text-sm text-blue-700">{insight.action}</p>
                    </div>
                    <div className="mt-1">
                      <p className="text-xs text-gray-500">Why: {insight.reasoning}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Sample Customer Feedback */}
        {(promoterResponses.length > 0 || detractorResponses.length > 0) && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Sample Customer Feedback
            </h4>
            
            {promoterResponses.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  What Promoters Say ({promoterResponses.length} examples)
                </h5>
                <div className="space-y-2">
                  {promoterResponses.slice(0, 2).map((response, index) => (
                    <div key={index} className="p-3 bg-green-50 border-l-4 border-green-400 rounded">
                      <p className="text-sm text-green-800">{response.nps_explanation}</p>
                      <p className="text-xs text-green-600 mt-1">
                        {response.title_text} • Score: {response.nps_score}/10
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {detractorResponses.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  What Detractors Say ({detractorResponses.length} examples)
                </h5>
                <div className="space-y-2">
                  {detractorResponses.slice(0, 2).map((response, index) => (
                    <div key={index} className="p-3 bg-red-50 border-l-4 border-red-400 rounded">
                      <p className="text-sm text-red-800">{response.nps_explanation}</p>
                      <p className="text-xs text-red-600 mt-1">
                        {response.title_text} • Score: {response.nps_score}/10
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
      </CardContent>
    </Card>
  );
}
