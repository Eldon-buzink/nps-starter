"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, Users, MessageSquare, BarChart3, AlertCircle } from "lucide-react"
import { getNpsSummary, getRecentResponses, type NpsSummary, type RecentResponse } from "@/lib/data"
import { useEffect, useState } from "react"

export function Dashboard() {
  const [npsData, setNpsData] = useState<NpsSummary | null>(null)
  const [recentResponses, setRecentResponses] = useState<RecentResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [summary, recent] = await Promise.all([
          getNpsSummary(),
          getRecentResponses(5)
        ])
        setNpsData(summary)
        setRecentResponses(recent)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NPS Dashboard</h1>
          <p className="text-muted-foreground">Loading your NPS insights...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Fallback to mock data if no real data
  const data = npsData || {
    total_responses: 0,
    nps_score: 0,
    promoters: 0,
    passives: 0,
    detractors: 0,
    avg_score: 0
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">NPS Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor and analyze your Net Promoter Score insights
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.nps_score}</div>
            <p className="text-xs text-muted-foreground">
              Net Promoter Score
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total_responses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              All time responses
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.avg_score}</div>
            <p className="text-xs text-muted-foreground">
              Out of 10
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promoters</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.promoters.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {data.total_responses > 0 ? Math.round((data.promoters / data.total_responses) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* NPS Breakdown */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Promoters</CardTitle>
            <CardDescription>Score 9-10</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{data.promoters.toLocaleString()}</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${data.total_responses > 0 ? (data.promoters / data.total_responses) * 100 : 0}%` }}
              ></div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {data.total_responses > 0 ? Math.round((data.promoters / data.total_responses) * 100) : 0}% of responses
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-yellow-600">Passives</CardTitle>
            <CardDescription>Score 7-8</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{data.passives.toLocaleString()}</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-yellow-600 h-2 rounded-full" 
                style={{ width: `${data.total_responses > 0 ? (data.passives / data.total_responses) * 100 : 0}%` }}
              ></div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {data.total_responses > 0 ? Math.round((data.passives / data.total_responses) * 100) : 0}% of responses
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Detractors</CardTitle>
            <CardDescription>Score 0-6</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{data.detractors.toLocaleString()}</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-red-600 h-2 rounded-full" 
                style={{ width: `${data.total_responses > 0 ? (data.detractors / data.total_responses) * 100 : 0}%` }}
              ></div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {data.total_responses > 0 ? Math.round((data.detractors / data.total_responses) * 100) : 0}% of responses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest NPS responses and insights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentResponses.length > 0 ? (
                recentResponses.map((response) => {
                  const getCategoryColor = (category: string) => {
                    switch (category) {
                      case 'promoter': return 'bg-green-500'
                      case 'passive': return 'bg-yellow-500'
                      case 'detractor': return 'bg-red-500'
                      default: return 'bg-gray-500'
                    }
                  }
                  
                  const getCategoryLabel = (category: string) => {
                    switch (category) {
                      case 'promoter': return 'Promoter'
                      case 'passive': return 'Passive'
                      case 'detractor': return 'Detractor'
                      default: return 'Unknown'
                    }
                  }
                  
                  return (
                    <div key={response.id} className="flex items-center space-x-4">
                      <div className={`w-2 h-2 ${getCategoryColor(response.nps_category)} rounded-full`}></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{getCategoryLabel(response.nps_category)} response</p>
                        <p className="text-xs text-muted-foreground">
                          Score: {response.nps_score} - {response.nps_explanation || 'No comment'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {response.survey_name} • {response.title_text}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(response.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  )
                })
              ) : (
                <p className="text-muted-foreground text-center py-4">No recent responses found</p>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button className="w-full justify-start" variant="outline">
                <BarChart3 className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                View All Responses
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <AlertCircle className="mr-2 h-4 w-4" />
                Export Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
