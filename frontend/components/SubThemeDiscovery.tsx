"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Lightbulb, Target, Quote, TrendingUp } from "lucide-react";

interface SubTheme {
  subTheme: string;
  description: string;
  percentage: number;
  sampleQuote: string;
  recommendation: string;
}

interface SubThemeDiscoveryProps {
  theme: string;
  responses: Array<{
    nps_score: number;
    nps_explanation: string;
    title_text: string;
  }>;
  hideHeader?: boolean;
}

export default function SubThemeDiscovery({ theme, responses, hideHeader = false }: SubThemeDiscoveryProps) {
  const [subThemes, setSubThemes] = useState<SubTheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (responses.length > 0) {
      discoverSubThemes();
    }
  }, [theme, responses]);

  const discoverSubThemes = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/themes/sub-themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          theme,
          responses
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API Error:', response.status, errorData);
        throw new Error(`API Error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      setSubThemes(data.subThemes || []);
    } catch (err) {
      console.error('Error discovering sub-themes:', err);
      setError(`Kon sub-thema's niet laden: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        {!hideHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Sub-Thema Analyse
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            {/* Modern animated dots */}
            <div className="flex space-x-2 mb-6">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
            </div>
            
            {/* Progress indicator */}
            <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mb-4">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full animate-pulse"></div>
            </div>
            
            {/* Loading text with typing effect */}
            <div className="text-center">
              <p className="text-lg font-medium text-gray-800 mb-2">
                Analyseert {responses.length} reacties...
              </p>
              <p className="text-sm text-gray-500 animate-pulse">
                AI ontdekt patronen en sub-thema's
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        {!hideHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Sub-Thema Analyse
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-red-600 text-center py-4">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (subThemes.length === 0) {
    return (
      <Card className="w-full">
        {!hideHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Sub-Thema Analyse
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-gray-600 text-center py-4">
            Geen sub-thema's gevonden voor {theme}.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      {!hideHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Sub-Thema Analyse: {theme.replace('_', ' ')}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          AI-analyse van {responses.length} klantreacties om specifieke sub-thema's te identificeren.
        </p>

        <div className="space-y-4">
          {subThemes.map((subTheme, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-lg">{subTheme.subTheme}</h4>
                  <p className="text-sm text-gray-600 mt-1">{subTheme.description}</p>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  ~{subTheme.percentage}%
                </Badge>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <Quote className="h-4 w-4 text-gray-500 mt-0.5" />
                    <span className="text-sm font-medium text-gray-700">Voorbeeld reactie:</span>
                  </div>
                  <blockquote className="text-sm text-gray-700 italic pl-6 border-l-2 border-gray-200">
                    "{subTheme.sampleQuote}"
                  </blockquote>
                </div>

                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <Target className="h-4 w-4 text-green-600 mt-0.5" />
                    <span className="text-sm font-medium text-gray-700">Aanbeveling:</span>
                  </div>
                  <p className="text-sm text-gray-700 pl-6">
                    {subTheme.recommendation}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Totaal:</span>
          </div>
          <p className="text-sm text-blue-700 mt-1">
            Deze sub-thema's dekken {subThemes.reduce((sum, st) => sum + st.percentage, 0)}% van alle {theme} feedback.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
