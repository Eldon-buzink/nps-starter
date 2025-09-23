import { Suspense } from 'react'
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
import WinnersLosers from '@/components/WinnersLosers'
import { getTopTitleMoMMoves } from '@/lib/winners-losers'

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

interface OverviewPageProps {
  searchParams: {
    start?: string;
    end?: string;
    survey?: string;
    title?: string;
  };
}

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  // Get Winners/Losers data with error handling
  let winnersLosersData = [];
  try {
    winnersLosersData = await getTopTitleMoMMoves({
      start: searchParams.start ?? undefined,
      end: searchParams.end ?? undefined,
      survey: searchParams.survey ?? null,
      minResponses: 30,
      topK: 5,
    });
  } catch (error) {
    console.error('Error fetching winners/losers data:', error);
    // Use empty data as fallback
  }

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

      {/* Current Filters Display */}
      {(searchParams.start || searchParams.end || searchParams.survey || searchParams.title) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {searchParams.start && (
                <Badge variant="outline">
                  From: {format(new Date(searchParams.start), "MMM dd, yyyy")}
                </Badge>
              )}
              {searchParams.end && (
                <Badge variant="outline">
                  To: {format(new Date(searchParams.end), "MMM dd, yyyy")}
                </Badge>
              )}
              {searchParams.survey && (
                <Badge variant="outline">
                  Survey: {searchParams.survey}
                </Badge>
              )}
              {searchParams.title && (
                <Badge variant="outline">
                  Title: {searchParams.title}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Winners/Losers */}
      <Suspense fallback={<div>Loading winners/losers...</div>}>
        <WinnersLosers data={winnersLosersData} minResponses={30} />
      </Suspense>

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
