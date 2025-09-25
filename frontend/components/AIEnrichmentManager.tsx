"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Brain, 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Zap,
  BarChart3,
  TrendingUp
} from 'lucide-react'

interface EnrichmentStatus {
  processed: number
  retried: number
  failed: number
  skipped_no_comment: number
  error_details: string[]
  is_running?: boolean
  total_responses?: number
  progress_percentage?: number
}

interface EnrichmentStats {
  total_responses: number
  enriched_responses: number
  pending_responses: number
  last_enrichment: string | null
  themes_found: number
  avg_sentiment: number
}

export function AIEnrichmentManager() {
  const [status, setStatus] = useState<EnrichmentStatus | null>(null)
  const [stats, setStats] = useState<EnrichmentStats | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch current enrichment status
  const fetchStatus = async () => {
    try {
      const response = await fetch('http://localhost:8001/enrich/status')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (err) {
      console.error('Error fetching enrichment status:', err)
    }
  }

  // Fetch enrichment statistics
  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:8001/enrich/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Error fetching enrichment stats:', err)
    }
  }

  // Start enrichment process
  const startEnrichment = async (forceReprocess = false) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('http://localhost:8001/enrich/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch_size: 50,
          max_retries: 3,
          force_reprocess: forceReprocess
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setStatus(result)
      
      if (result.failed > 0) {
        setError(`${result.failed} responses failed to process. Check error details.`)
      }
      
      // Refresh stats after enrichment
      await fetchStats()
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start enrichment')
    } finally {
      setIsLoading(false)
    }
  }

  // Load initial data
  useEffect(() => {
    fetchStatus()
    fetchStats()
  }, [])

  const getProgressPercentage = () => {
    if (!stats) return 0
    return stats.total_responses > 0 ? (stats.enriched_responses / stats.total_responses) * 100 : 0
  }

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.3) return 'text-green-600'
    if (sentiment < -0.3) return 'text-red-600'
    return 'text-yellow-600'
  }

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 0.3) return 'Positive'
    if (sentiment < -0.3) return 'Negative'
    return 'Neutral'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            AI Enrichment
          </h2>
          <p className="text-muted-foreground">
            Analyze NPS responses with AI-powered theme extraction and sentiment analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => startEnrichment(false)}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isLoading ? 'Processing...' : 'Start Enrichment'}
          </Button>
          <Button
            onClick={() => startEnrichment(true)}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reprocess All
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Enrichment Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress Overview */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Enrichment Progress
            </CardTitle>
            <CardDescription>
              Current status of AI analysis across all NPS responses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{stats.enriched_responses} / {stats.total_responses} responses</span>
              </div>
              <Progress value={getProgressPercentage()} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {getProgressPercentage().toFixed(1)}% complete
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.enriched_responses}</div>
                <div className="text-xs text-muted-foreground">Enriched</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending_responses}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.themes_found}</div>
                <div className="text-xs text-muted-foreground">Themes Found</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getSentimentColor(stats.avg_sentiment)}`}>
                  {getSentimentLabel(stats.avg_sentiment)}
                </div>
                <div className="text-xs text-muted-foreground">Avg Sentiment</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Latest Run Status */}
      {status && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Latest Run Results
            </CardTitle>
            <CardDescription>
              Results from the most recent enrichment process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{status.processed}</div>
                <div className="text-xs text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{status.retried}</div>
                <div className="text-xs text-muted-foreground">Retried</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{status.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{status.skipped_no_comment}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
            </div>

            {status.error_details && status.error_details.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Error Details:</h4>
                <div className="space-y-1">
                  {status.error_details.slice(0, 3).map((error, index) => (
                    <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  ))}
                  {status.error_details.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      ... and {status.error_details.length - 3} more errors
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Features Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            AI Analysis Features
          </CardTitle>
          <CardDescription>
            What the AI enrichment process analyzes in your NPS responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                Theme Extraction
              </h4>
              <p className="text-sm text-muted-foreground">
                Automatically identifies key themes like customer service, product quality, pricing, etc.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Sentiment Analysis
              </h4>
              <p className="text-sm text-muted-foreground">
                Analyzes emotional tone and sentiment of each response (-1 to +1 scale)
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                Keyword Extraction
              </h4>
              <p className="text-sm text-muted-foreground">
                Extracts important keywords and phrases for deeper analysis
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
