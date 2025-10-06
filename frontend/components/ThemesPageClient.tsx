'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FiltersBar from '@/components/filters/FiltersBar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Lightbulb, Brain, Database, CheckCircle, AlertCircle, Info } from "lucide-react"
import CollapsibleThemeCategories from '@/components/CollapsibleThemeCategories'
import { getThemeMapping } from '@/lib/theme-mapping'
import ThemesLoadingSkeleton from './ThemesLoadingSkeleton'
import LoadingSpinner from './LoadingSpinner'

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

interface ThemesPageClientProps {
  initialThemes: Theme[]
  surveys: string[]
  titles: string[]
  defaultTitle?: string
}

export default function ThemesPageClient({ 
  initialThemes, 
  surveys, 
  titles, 
  defaultTitle 
}: ThemesPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [themes, setThemes] = useState<Theme[]>(initialThemes)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // Handle filter changes with loading state
  useEffect(() => {
    const handleFilterChange = async () => {
      setIsLoading(true)
      
      // Fetch new data based on current search params
      try {
        const params = new URLSearchParams(searchParams.toString())
        const response = await fetch(`/api/themes?${params.toString()}`)
        const data = await response.json()
        setThemes(data.themes || [])
      } catch (error) {
        console.error('Error fetching themes:', error)
        // Keep existing themes on error
      } finally {
        setIsLoading(false)
        setIsInitialLoad(false)
      }
    }

    // Always fetch data when searchParams change (including initial load)
    handleFilterChange()
  }, [searchParams])

  if (isLoading) {
    return <ThemesLoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <FiltersBar 
        surveys={surveys} 
        titles={titles} 
        defaultTitle={defaultTitle} 
      />

      {/* Loading indicator for filter changes */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner text="Updating themes..." />
        </div>
      )}

      {/* Theme Discovery Summary */}
      {themes.length > 0 && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Theme Discovery & Explanations
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Understanding how themes are generated and their business relevance
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {themes.filter(t => t.source === 'base').length}
                </div>
                <div className="text-sm text-gray-600">Base Themes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {themes.filter(t => t.source === 'ai').length}
                </div>
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

            {/* Collapsible Theme Categories */}
            <CollapsibleThemeCategories themes={themes} getThemeMapping={getThemeMapping} searchParams={searchParams} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
