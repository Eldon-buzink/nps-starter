'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tag, TrendingUp, TrendingDown, Lightbulb, Brain, Database, CheckCircle, AlertCircle, Info, ChevronDown, ChevronRight } from "lucide-react"
import Link from "next/link"
import { ThemeInfoButton } from "@/components/ThemeInfoButton"

interface Theme {
  theme: string
  count_responses: number
  share_pct: number
  avg_sentiment: number
  avg_nps: number
  pct_promoters: number
  pct_passives: number
  pct_detractors: number
  pct_pos_sentiment: number
  pct_neg_sentiment: number
  explanation: string
  source: 'base' | 'ai'
  businessRelevance: 'high' | 'medium' | 'low'
  frequency: number
  confidence: number
}

interface CollapsibleThemeCategoriesProps {
  themes: Theme[]
  searchParams?: URLSearchParams
}

interface CategorySummary {
  totalThemes: number
  totalResponses: number
  avgNPS: number
  avgSentiment: number
  topTheme: Theme
  themes: Theme[]
}

export default function CollapsibleThemeCategories({ themes, searchParams }: CollapsibleThemeCategoriesProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Group themes by main category (simplified without theme mapping)
  const groupedThemes = themes.reduce((groups, theme) => {
    // Skip themes with invalid names
    if (!theme || !theme.theme) {
      console.warn('Skipping theme with invalid name:', theme);
      return groups;
    }
    
    // Simple categorization based on theme name
    let category = 'Other';
    const themeName = theme.theme.toLowerCase();
    
    if (themeName.includes('content') || themeName.includes('kwaliteit') || themeName.includes('journalistiek')) {
      category = 'Content';
    } else if (themeName.includes('service') || themeName.includes('klant') || themeName.includes('support')) {
      category = 'Customer Service';
    } else if (themeName.includes('delivery') || themeName.includes('bezorging') || themeName.includes('levering')) {
      category = 'Delivery';
    } else if (themeName.includes('pricing') || themeName.includes('prijs') || themeName.includes('kosten')) {
      category = 'Price';
    } else if (themeName.includes('ux') || themeName.includes('gebruik') || themeName.includes('interface')) {
      category = 'User Experience';
    }
    
    if (!groups[category]) groups[category] = [];
    groups[category].push(theme);
    return groups;
  }, {} as Record<string, Theme[]>);

  // Define category order (business priority)
  const categoryOrder = [
    'Content',
    'Customer Service', 
    'Delivery',
    'Price',
    'User Experience',
    'Other'
  ];

  // Sort themes within each category by volume (descending)
  Object.keys(groupedThemes).forEach(category => {
    groupedThemes[category].sort((a, b) => (b.count_responses || 0) - (a.count_responses || 0));
  });

  // Calculate category summaries
  const getCategorySummary = (category: string, categoryThemes: Theme[]): CategorySummary => {
    const totalThemes = categoryThemes.length;
    const totalResponses = categoryThemes.reduce((sum, theme) => sum + (theme.count_responses || 0), 0);
    const avgNPS = categoryThemes.reduce((sum, theme) => sum + (theme.avg_nps || 0), 0) / totalThemes;
    const avgSentiment = categoryThemes.reduce((sum, theme) => sum + (theme.avg_sentiment || 0), 0) / totalThemes;
    const topTheme = categoryThemes[0]; // Already sorted by volume

    return {
      totalThemes,
      totalResponses,
      avgNPS,
      avgSentiment,
      topTheme,
      themes: categoryThemes
    };
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryIcon = (category: string) => {
    // Return simple text instead of colored emojis
    return '';
  };

  const getCategoryColor = (category: string) => {
    // Return neutral colors for all categories
    return 'bg-gray-50 border-gray-200';
  };

  return (
    <div className="space-y-4">
      {categoryOrder.map((category) => {
        const categoryThemes = groupedThemes[category];
        if (!categoryThemes || categoryThemes.length === 0) return null;

        const summary = getCategorySummary(category, categoryThemes);
        const isExpanded = expandedCategories.has(category);
        const themesToShow = isExpanded ? categoryThemes : categoryThemes.slice(0, 4);

        return (
          <Card key={category} className={`${getCategoryColor(category)} border-2`}>
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => toggleCategory(category)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {category}
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {summary.totalThemes} themes • {summary.totalResponses.toLocaleString()} total responses
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold">Avg NPS</div>
                    <div className={`font-medium ${
                      summary.avgNPS >= 7 ? 'text-green-600' : 
                      summary.avgNPS >= 6 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {summary.avgNPS.toFixed(1)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">Sentiment</div>
                    <div className={`font-medium ${
                      summary.avgSentiment > 0 ? 'text-green-600' : 
                      summary.avgSentiment < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {summary.avgSentiment > 0 ? '+' : ''}{summary.avgSentiment.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">Top Theme</div>
                    <div className="font-medium text-blue-600">
                      {summary.topTheme.theme.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="space-y-3">
                {themesToShow.map((theme) => (
                  <Link
                    key={theme.theme}
                    href={`/themes/${encodeURIComponent(theme.theme)}${searchParams ? `?${searchParams.toString()}` : ''}`}
                    className="block border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium capitalize">
                          {theme.theme.replace(/_/g, ' ')}
                        </h4>
                        <Badge className={theme.source === 'ai' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                          {theme.source === 'ai' ? (
                            <>
                              <Brain className="h-3 w-3" />
                              <span className="ml-1">AI</span>
                            </>
                          ) : (
                            <>
                              <Database className="h-3 w-3" />
                              <span className="ml-1">Base</span>
                            </>
                          )}
                        </Badge>
                        <Badge className={
                          theme.businessRelevance === 'high' ? 'bg-green-100 text-green-800' :
                          theme.businessRelevance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {theme.businessRelevance === 'high' ? (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              <span className="ml-1">High</span>
                            </>
                          ) : theme.businessRelevance === 'medium' ? (
                            <>
                              <AlertCircle className="h-3 w-3" />
                              <span className="ml-1">Medium</span>
                            </>
                          ) : (
                            <>
                              <Info className="h-3 w-3" />
                              <span className="ml-1">Low</span>
                            </>
                          )}
                        </Badge>
                      </div>
                      
                      <ThemeInfoButton explanation={theme.explanation} />
                    </div>

                    {/* Detailed Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Volume:</span>
                        <span className="font-medium">{theme.count_responses || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Share:</span>
                        <span className="font-medium">{theme.share_pct?.toFixed(1) || 0}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Avg NPS:</span>
                        <span className={`font-medium ${
                          (theme.avg_nps || 0) >= 7 ? 'text-green-600' : 
                          (theme.avg_nps || 0) >= 6 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {(theme.avg_nps || 0).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Sentiment:</span>
                        <span className={`font-medium ${
                          (theme.avg_sentiment || 0) > 0 ? 'text-green-600' : 
                          (theme.avg_sentiment || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {(theme.avg_sentiment || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}

                {categoryThemes.length > 4 && (
                  <div className="flex justify-center pt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleCategory(category);
                      }}
                    >
                      {isExpanded ? 'Show Less' : `Show All ${categoryThemes.length} Themes`}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      }).filter(Boolean)}
    </div>
  );
}
