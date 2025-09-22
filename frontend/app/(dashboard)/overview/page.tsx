"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, TrendingUp, Users, MessageSquare, BarChart3, Filter, Download } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

// Mock data - replace with actual API calls
const mockData = {
  kpis: {
    currentNps: 42,
    previousNps: 38,
    totalResponses: 1247,
    promoters: 523,
    passives: 312,
    detractors: 412,
    responseRate: 15.2
  },
  monthlyTrends: [
    { month: 'Jan', nps: 35, responses: 89 },
    { month: 'Feb', nps: 38, responses: 95 },
    { month: 'Mar', nps: 42, responses: 112 },
    { month: 'Apr', nps: 40, responses: 98 },
    { month: 'May', nps: 45, responses: 125 },
    { month: 'Jun', nps: 42, responses: 118 }
  ],
  surveyBreakdown: [
    { survey: 'LLT_Nieuws', nps: 42, responses: 1247, change: 4 },
    { survey: 'Customer_Service', nps: 38, responses: 892, change: -2 },
    { survey: 'Product_Feedback', nps: 45, responses: 634, change: 7 }
  ],
  titleBreakdown: [
    { title: 'Trouw', nps: 44, responses: 456, change: 3 },
    { title: 'Volkskrant', nps: 40, responses: 321, change: -1 },
    { title: 'NRC', nps: 38, responses: 289, change: 2 },
    { title: 'AD', nps: 35, responses: 181, change: -3 }
  ]
}

export default function OverviewPage() {
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>({
    from: undefined,
    to: undefined
  })
  const [selectedSurvey, setSelectedSurvey] = useState<string>('all')
  const [selectedTitle, setSelectedTitle] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)

  const npsChange = mockData.kpis.currentNps - mockData.kpis.previousNps
  const npsChangePercent = ((npsChange / mockData.kpis.previousNps) * 100).toFixed(1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NPS Overview</h1>
          <p className="text-muted-foreground">
            Monitor your Net Promoter Score performance and trends
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Survey Type</label>
              <Select value={selectedSurvey} onValueChange={setSelectedSurvey}>
                <SelectTrigger>
                  <SelectValue placeholder="All surveys" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Surveys</SelectItem>
                  <SelectItem value="LLT_Nieuws">LLT Nieuws</SelectItem>
                  <SelectItem value="Customer_Service">Customer Service</SelectItem>
                  <SelectItem value="Product_Feedback">Product Feedback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Title</label>
              <Select value={selectedTitle} onValueChange={setSelectedTitle}>
                <SelectTrigger>
                  <SelectValue placeholder="All titles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Titles</SelectItem>
                  <SelectItem value="Trouw">Trouw</SelectItem>
                  <SelectItem value="Volkskrant">Volkskrant</SelectItem>
                  <SelectItem value="NRC">NRC</SelectItem>
                  <SelectItem value="AD">AD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={() => setIsLoading(true)} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Loading..." : "Apply Filters"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current NPS</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.kpis.currentNps}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {npsChange > 0 ? (
                <span className="text-green-600">+{npsChange} ({npsChangePercent}%)</span>
              ) : (
                <span className="text-red-600">{npsChange} ({npsChangePercent}%)</span>
              )}
              <span className="ml-1">vs last month</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.kpis.totalResponses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {mockData.kpis.responseRate}% response rate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promoters</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{mockData.kpis.promoters}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((mockData.kpis.promoters / mockData.kpis.totalResponses) * 100)}% of total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Detractors</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{mockData.kpis.detractors}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((mockData.kpis.detractors / mockData.kpis.totalResponses) * 100)}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">NPS Trends</TabsTrigger>
          <TabsTrigger value="surveys">By Survey</TabsTrigger>
          <TabsTrigger value="titles">By Title</TabsTrigger>
        </TabsList>
        
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>NPS Score Over Time</CardTitle>
              <CardDescription>Monthly NPS trends and response volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Chart component would go here</p>
                  <p className="text-sm text-gray-400">Monthly NPS trends visualization</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="surveys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>NPS by Survey Type</CardTitle>
              <CardDescription>Performance breakdown across different surveys</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockData.surveyBreakdown.map((survey, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium">{survey.survey}</p>
                      <p className="text-sm text-muted-foreground">{survey.responses} responses</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold">{survey.nps}</p>
                        <div className="flex items-center">
                          {survey.change > 0 ? (
                            <span className="text-green-600 text-sm">+{survey.change}</span>
                          ) : (
                            <span className="text-red-600 text-sm">{survey.change}</span>
                          )}
                          <span className="text-muted-foreground text-sm ml-1">vs last month</span>
                        </div>
                      </div>
                      <Badge variant={survey.nps >= 40 ? "default" : survey.nps >= 20 ? "secondary" : "destructive"}>
                        {survey.nps >= 40 ? "Excellent" : survey.nps >= 20 ? "Good" : "Needs Improvement"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="titles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>NPS by Title/Publication</CardTitle>
              <CardDescription>Performance breakdown by newspaper title</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockData.titleBreakdown.map((title, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium">{title.title}</p>
                      <p className="text-sm text-muted-foreground">{title.responses} responses</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold">{title.nps}</p>
                        <div className="flex items-center">
                          {title.change > 0 ? (
                            <span className="text-green-600 text-sm">+{title.change}</span>
                          ) : (
                            <span className="text-red-600 text-sm">{title.change}</span>
                          )}
                          <span className="text-muted-foreground text-sm ml-1">vs last month</span>
                        </div>
                      </div>
                      <Badge variant={title.nps >= 40 ? "default" : title.nps >= 20 ? "secondary" : "destructive"}>
                        {title.nps >= 40 ? "Excellent" : title.nps >= 20 ? "Good" : "Needs Improvement"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
