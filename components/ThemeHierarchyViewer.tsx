'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ChevronDown, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown,
  Info,
  BarChart3,
  Users,
  Star
} from 'lucide-react'

interface ThemeHierarchy {
  main_category: string
  main_category_display: string
  main_category_color: string
  sub_category: string
  sub_category_display: string
  original_theme: string
  response_count: number
  avg_nps: number
  confidence: number
  source: 'pattern' | 'ai' | 'fallback'
}

interface ThemeHierarchyStats {
  main_category: string
  main_category_display: string
  main_category_color: string
  sub_category: string
  sub_category_display: string
  total_themes: number
  total_responses: number
  avg_nps: number
  avg_confidence: number
  pattern_mapped: number
  ai_mapped: number
  fallback_mapped: number
}

interface ThemeHierarchyViewerProps {
  data?: ThemeHierarchy[]
  stats?: ThemeHierarchyStats[]
  onThemeSelect?: (theme: string) => void
  selectedTheme?: string
}

export function ThemeHierarchyViewer({ 
  data = [], 
  stats = [], 
  onThemeSelect,
  selectedTheme 
}: ThemeHierarchyViewerProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'hierarchy' | 'stats'>('hierarchy')

  // Group data by main category
  const groupedData = data.reduce((acc, item) => {
    if (!acc[item.main_category]) {
      acc[item.main_category] = []
    }
    acc[item.main_category].push(item)
    return acc
  }, {} as Record<string, ThemeHierarchy[]>)

  // Group stats by main category
  const groupedStats = stats.reduce((acc, item) => {
    if (!acc[item.main_category]) {
      acc[item.main_category] = []
    }
    acc[item.main_category].push(item)
    return acc
  }, {} as Record<string, ThemeHierarchyStats[]>)

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'pattern': return '🎯'
      case 'ai': return '🤖'
      case 'fallback': return '❓'
      default: return '❓'
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'pattern': return 'bg-blue-100 text-blue-800'
      case 'ai': return 'bg-green-100 text-green-800'
      case 'fallback': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getNpsColor = (nps: number) => {
    if (nps >= 7) return 'text-green-600'
    if (nps >= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Theme Hierarchy</h2>
          <p className="text-muted-foreground">
            {data.length} themes organized into {Object.keys(groupedData).length} main categories
          </p>
        </div>
        
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'hierarchy' | 'stats')}>
          <TabsList>
            <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Hierarchy View */}
      {viewMode === 'hierarchy' && (
        <div className="space-y-4">
          {Object.entries(groupedData).map(([mainCategory, items]) => {
            const isExpanded = expandedCategories.has(mainCategory)
            const mainCategoryData = items[0]
            const totalResponses = items.reduce((sum, item) => sum + item.response_count, 0)
            const avgNps = items.reduce((sum, item) => sum + item.avg_nps, 0) / items.length

            return (
              <Card key={mainCategory} className="overflow-hidden">
                <CardHeader 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleCategory(mainCategory)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: mainCategoryData.main_category_color }}
                      />
                      <CardTitle className="text-lg">
                        {mainCategoryData.main_category_display}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {totalResponses.toLocaleString()}
                      </div>
                      <div className={`flex items-center gap-1 ${getNpsColor(avgNps)}`}>
                        <Star className="h-4 w-4" />
                        {avgNps.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {Object.entries(
                        items.reduce((acc, item) => {
                          if (!acc[item.sub_category]) {
                            acc[item.sub_category] = []
                          }
                          acc[item.sub_category].push(item)
                          return acc
                        }, {} as Record<string, ThemeHierarchy[]>)
                      ).map(([subCategory, subItems]) => {
                        const subCategoryData = subItems[0]
                        const subTotalResponses = subItems.reduce((sum, item) => sum + item.response_count, 0)
                        const subAvgNps = subItems.reduce((sum, item) => sum + item.avg_nps, 0) / subItems.length

                        return (
                          <div key={subCategory} className="border-l-2 border-muted pl-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm">
                                {subCategoryData.sub_category_display}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{subTotalResponses} responses</span>
                                <span className={getNpsColor(subAvgNps)}>
                                  NPS: {subAvgNps.toFixed(1)}
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              {subItems.map((item) => (
                                <div
                                  key={item.original_theme}
                                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                                    selectedTheme === item.original_theme 
                                      ? 'bg-primary/10 border border-primary/20' 
                                      : 'hover:bg-muted/50'
                                  }`}
                                  onClick={() => onThemeSelect?.(item.original_theme)}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-muted-foreground">
                                      {item.original_theme}
                                    </span>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${getSourceColor(item.source)}`}
                                    >
                                      {getSourceIcon(item.source)} {item.source}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs">
                                    <span className={getConfidenceColor(item.confidence)}>
                                      {Math.round(item.confidence * 100)}%
                                    </span>
                                    <span className="text-muted-foreground">
                                      {item.response_count}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Statistics View */}
      {viewMode === 'stats' && (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(groupedStats).map(([mainCategory, items]) => {
            const mainCategoryData = items[0]
            const totalThemes = items.reduce((sum, item) => sum + item.total_themes, 0)
            const totalResponses = items.reduce((sum, item) => sum + item.total_responses, 0)
            const avgNps = items.reduce((sum, item) => sum + item.avg_nps, 0) / items.length
            const avgConfidence = items.reduce((sum, item) => sum + item.avg_confidence, 0) / items.length

            return (
              <Card key={mainCategory}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: mainCategoryData.main_category_color }}
                    />
                    <CardTitle className="text-lg">
                      {mainCategoryData.main_category_display}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Overview Stats */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Themes</p>
                        <p className="text-2xl font-bold">{totalThemes}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Responses</p>
                        <p className="text-2xl font-bold">{totalResponses.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg NPS</p>
                        <p className={`text-2xl font-bold ${getNpsColor(avgNps)}`}>
                          {avgNps.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Confidence</p>
                        <p className={`text-2xl font-bold ${getConfidenceColor(avgConfidence)}`}>
                          {Math.round(avgConfidence * 100)}%
                        </p>
                      </div>
                    </div>

                    {/* Mapping Sources */}
                    <div>
                      <p className="text-sm font-medium mb-2">Mapping Sources</p>
                      <div className="flex gap-2">
                        <Badge className="bg-blue-100 text-blue-800">
                          🎯 Pattern: {items.reduce((sum, item) => sum + item.pattern_mapped, 0)}
                        </Badge>
                        <Badge className="bg-green-100 text-green-800">
                          🤖 AI: {items.reduce((sum, item) => sum + item.ai_mapped, 0)}
                        </Badge>
                        <Badge className="bg-gray-100 text-gray-800">
                          ❓ Fallback: {items.reduce((sum, item) => sum + item.fallback_mapped, 0)}
                        </Badge>
                      </div>
                    </div>

                    {/* Sub-categories */}
                    <div>
                      <p className="text-sm font-medium mb-2">Sub-categories</p>
                      <div className="space-y-1">
                        {items.map((item) => (
                          <div key={item.sub_category} className="flex items-center justify-between text-xs">
                            <span>{item.sub_category_display}</span>
                            <span className="text-muted-foreground">
                              {item.total_responses} responses
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mapping Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800">🎯 Pattern</Badge>
              <span>Automatically mapped using predefined rules</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800">🤖 AI</Badge>
              <span>Classified using AI analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-gray-100 text-gray-800">❓ Fallback</Badge>
              <span>Default mapping for unknown themes</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
