'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Info, 
  Brain, 
  Database, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Lightbulb
} from "lucide-react";

interface ThemeExplanation {
  name: string;
  source: 'base' | 'ai_discovered';
  explanation: string;
  businessRelevance: 'high' | 'medium' | 'low';
  frequency?: number;
  confidence?: number;
}

interface ThemeExplanationProps {
  themes: ThemeExplanation[];
  title?: string;
  description?: string;
}

export default function ThemeExplanation({ 
  themes, 
  title = "Theme Discovery Results",
  description = "AI-generated themes with explanations"
}: ThemeExplanationProps) {
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);

  const getSourceIcon = (source: 'base' | 'ai_discovered') => {
    return source === 'ai_discovered' ? <Brain className="h-4 w-4" /> : <Database className="h-4 w-4" />;
  };

  const getSourceColor = (source: 'base' | 'ai_discovered') => {
    return source === 'ai_discovered' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';
  };

  const getRelevanceIcon = (relevance: 'high' | 'medium' | 'low') => {
    switch (relevance) {
      case 'high': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'medium': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'low': return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRelevanceColor = (relevance: 'high' | 'medium' | 'low') => {
    switch (relevance) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-gray-100 text-gray-800';
    }
  };

  const baseThemes = themes.filter(t => t.source === 'base');
  const aiThemes = themes.filter(t => t.source === 'ai_discovered');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{baseThemes.length}</div>
            <div className="text-sm text-gray-600">Base Themes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{aiThemes.length}</div>
            <div className="text-sm text-gray-600">AI Discovered</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {themes.filter(t => t.businessRelevance === 'high').length}
            </div>
            <div className="text-sm text-gray-600">High Relevance</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{themes.length}</div>
            <div className="text-sm text-gray-600">Total Themes</div>
          </div>
        </div>

        {/* Theme List */}
        <div className="space-y-3">
          {themes.map((theme, index) => (
            <div 
              key={theme.name}
              className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium capitalize">
                    {theme.name.replace(/_/g, ' ')}
                  </h4>
                  <Badge className={getSourceColor(theme.source)}>
                    {getSourceIcon(theme.source)}
                    <span className="ml-1">
                      {theme.source === 'ai_discovered' ? 'AI Generated' : 'Base Theme'}
                    </span>
                  </Badge>
                  <Badge className={getRelevanceColor(theme.businessRelevance)}>
                    {getRelevanceIcon(theme.businessRelevance)}
                    <span className="ml-1 capitalize">{theme.businessRelevance} Relevance</span>
                  </Badge>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedTheme(expandedTheme === theme.name ? null : theme.name)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </div>

              {/* Expanded Details */}
              {expandedTheme === theme.name && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                  <div>
                    <strong>Explanation:</strong>
                    <p className="text-sm text-gray-700 mt-1">{theme.explanation}</p>
                  </div>
                  
                  {theme.source === 'ai_discovered' && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {theme.confidence && (
                        <div>
                          <strong>AI Confidence:</strong>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full" 
                                style={{ width: `${theme.confidence * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-xs">{(theme.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      )}
                      
                      {theme.frequency && (
                        <div>
                          <strong>Frequency:</strong>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${theme.frequency * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-xs">{(theme.frequency * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500">
                    {theme.source === 'ai_discovered' 
                      ? '🤖 This theme was discovered by AI analysis of customer feedback'
                      : '📋 This is a predefined business category'
                    }
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* AI Discovery Explanation */}
        {aiThemes.length > 0 && (
          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
              <Brain className="h-4 w-4" />
              How AI Theme Discovery Works
            </h4>
            <div className="text-sm text-purple-800 space-y-2">
              <p>
                <strong>AI Analysis:</strong> Our AI analyzed {themes.length} customer responses to discover new themes that weren't in our predefined categories.
              </p>
              <p>
                <strong>Business Relevance:</strong> Each discovered theme is scored for business relevance to ensure it's actionable for improving customer experience.
              </p>
              <p>
                <strong>Confidence Scoring:</strong> AI confidence scores indicate how certain the system is about each theme's validity and importance.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
