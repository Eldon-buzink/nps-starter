"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, Users, MessageSquare, BarChart3, Upload, AlertCircle } from "lucide-react"

export function Dashboard() {
  // Mock data for demonstration
  const mockData = {
    totalResponses: 1247,
    npsScore: 42,
    promoters: 523,
    passives: 312,
    detractors: 412,
    avgScore: 7.2,
    recentResponses: 23
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NPS Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and analyze your Net Promoter Score insights
          </p>
        </div>
        <Button className="flex items-center space-x-2">
          <Upload className="h-4 w-4" />
          <span>Upload New Data</span>
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.npsScore}</div>
            <p className="text-xs text-muted-foreground">
              +2.1% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.totalResponses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +{mockData.recentResponses} this week
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.avgScore}</div>
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
            <div className="text-2xl font-bold">{mockData.promoters}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((mockData.promoters / mockData.totalResponses) * 100)}% of total
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
            <div className="text-3xl font-bold text-green-600">{mockData.promoters}</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${(mockData.promoters / mockData.totalResponses) * 100}%` }}
              ></div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {Math.round((mockData.promoters / mockData.totalResponses) * 100)}% of responses
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-yellow-600">Passives</CardTitle>
            <CardDescription>Score 7-8</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{mockData.passives}</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-yellow-600 h-2 rounded-full" 
                style={{ width: `${(mockData.passives / mockData.totalResponses) * 100}%` }}
              ></div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {Math.round((mockData.passives / mockData.totalResponses) * 100)}% of responses
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Detractors</CardTitle>
            <CardDescription>Score 0-6</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{mockData.detractors}</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-red-600 h-2 rounded-full" 
                style={{ width: `${(mockData.detractors / mockData.totalResponses) * 100}%` }}
              ></div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {Math.round((mockData.detractors / mockData.totalResponses) * 100)}% of responses
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
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">New promoter response</p>
                  <p className="text-xs text-muted-foreground">Score: 9 - "Excellent service!"</p>
                </div>
                <span className="text-xs text-muted-foreground">2m ago</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Passive response</p>
                  <p className="text-xs text-muted-foreground">Score: 7 - "Good overall experience"</p>
                </div>
                <span className="text-xs text-muted-foreground">5m ago</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Detractor response</p>
                  <p className="text-xs text-muted-foreground">Score: 4 - "Needs improvement"</p>
                </div>
                <span className="text-xs text-muted-foreground">8m ago</span>
              </div>
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
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV Data
              </Button>
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
