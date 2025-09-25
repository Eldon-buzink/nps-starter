"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Search, 
  Filter, 
  CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import AiExplainer from '@/components/AiExplainer'
import { getSimilarToResponse } from '@/lib/trends'
import { getRecentResponses } from '@/lib/data'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Mock data for themes and sentiment (until AI enrichment is implemented)
const mockThemes = ['klantenservice', 'content_kwaliteit', 'bezorging', 'pricing', 'app_ux']
const mockSentiments = [0.8, 0.2, -0.3, 0.6, -0.1, 0.9, -0.5, 0.4, -0.2, 0.7]

export default function ResponsesPage() {
  const [responses, setResponses] = useState<any[]>([])
  const [filteredResponses, setFilteredResponses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSurvey, setSelectedSurvey] = useState('all')
  const [selectedTitle, setSelectedTitle] = useState('all')
  const [selectedNpsBucket, setSelectedNpsBucket] = useState('all')
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>({
    from: undefined,
    to: undefined
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedResponse, setSelectedResponse] = useState<any>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [similarResponses, setSimilarResponses] = useState<any[]>([])
  const [loadingSimilar, setLoadingSimilar] = useState(false)
  const [availableSurveys, setAvailableSurveys] = useState<string[]>([])
  const [availableTitles, setAvailableTitles] = useState<string[]>([])
  const itemsPerPage = 10

  // Fetch real data on component mount
  useEffect(() => {
    async function fetchResponses() {
      try {
        setLoading(true)
        const data = await getRecentResponses(100) // Get 100 most recent responses
        
        // Try to get AI enrichment data for these responses
        const responseIds = data.map(r => r.id)
        const { data: enrichmentData } = await supabase
          .from('nps_ai_enrichment')
          .select('response_id, themes, sentiment_score, sentiment_label, keywords')
          .in('response_id', responseIds)
        
        // Create a map of enrichment data by response ID
        const enrichmentMap = new Map()
        if (enrichmentData) {
          enrichmentData.forEach(enrichment => {
            enrichmentMap.set(enrichment.response_id, enrichment)
          })
        }
        
        // Combine response data with AI enrichment data
        const enrichedData = data.map((response, index) => {
          const enrichment = enrichmentMap.get(response.id)
          
          if (enrichment) {
            // Use real AI enrichment data
            return {
              ...response,
              themes: enrichment.themes || [],
              sentiment: enrichment.sentiment_score || 0,
              sentiment_label: enrichment.sentiment_label || 'neutral',
              keywords: enrichment.keywords || [],
              similar_comments: [] // Will be populated when user clicks on a response
            }
          } else {
            // Fall back to mock data for responses without AI enrichment
            return {
              ...response,
              themes: [mockThemes[index % mockThemes.length]],
              sentiment: mockSentiments[index % mockSentiments.length],
              sentiment_label: mockSentiments[index % mockSentiments.length] > 0.3 ? 'positive' : 
                              mockSentiments[index % mockSentiments.length] < -0.3 ? 'negative' : 'neutral',
              keywords: [],
              similar_comments: [] // Will be populated when user clicks on a response
            }
          }
        })
        
            setResponses(enrichedData)
            
            // Extract unique surveys and titles for filter options
            const uniqueSurveys = [...new Set(data.map(r => r.survey_name).filter(Boolean))]
            const uniqueTitles = [...new Set(data.map(r => r.title_text).filter(Boolean))]
            setAvailableSurveys(uniqueSurveys)
            setAvailableTitles(uniqueTitles)
          } catch (error) {
            console.error('Error fetching responses:', error)
          } finally {
            setLoading(false)
          }
        }
        
        fetchResponses()
      }, [])

  // Filter responses based on current filters
  useEffect(() => {
    let filtered = responses

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(response => 
        response.nps_explanation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        response.title_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        response.survey_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Survey filter
    if (selectedSurvey !== 'all') {
      filtered = filtered.filter(response => response.survey_name === selectedSurvey)
    }

    // Title filter
    if (selectedTitle !== 'all') {
      filtered = filtered.filter(response => response.title_text === selectedTitle)
    }

    // NPS bucket filter
    if (selectedNpsBucket !== 'all') {
      const bucketRanges = {
        'detractors': (score: number) => score >= 0 && score <= 6,
        'passives': (score: number) => score >= 7 && score <= 8,
        'promoters': (score: number) => score >= 9 && score <= 10
      }
      filtered = filtered.filter(response => 
        bucketRanges[selectedNpsBucket as keyof typeof bucketRanges](response.nps_score)
      )
    }

    setFilteredResponses(filtered)
    setCurrentPage(1)
  }, [searchTerm, selectedSurvey, selectedTitle, selectedNpsBucket, responses])

  const totalPages = Math.ceil(filteredResponses.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentResponses = filteredResponses.slice(startIndex, endIndex)

  const getNpsBadgeVariant = (score: number) => {
    if (score >= 9) return 'default'
    if (score >= 7) return 'secondary'
    return 'destructive'
  }

  const getNpsBadgeText = (score: number) => {
    if (score >= 9) return 'Promoter'
    if (score >= 7) return 'Passive'
    return 'Detractor'
  }

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 0.1) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (sentiment < -0.1) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-gray-600" />
  }

  const getSentimentBadgeVariant = (sentiment: number) => {
    if (sentiment > 0.1) return 'default'
    if (sentiment < -0.1) return 'destructive'
    return 'secondary'
  }

  const openResponseDrawer = async (response: any) => {
    setSelectedResponse(response)
    setIsDrawerOpen(true)
    
    // Load similar responses
    setLoadingSimilar(true)
    try {
      const similar = await getSimilarToResponse(response.id, 5)
      setSimilarResponses(similar)
    } catch (error) {
      console.error('Error loading similar responses:', error)
      setSimilarResponses([])
    } finally {
      setLoadingSimilar(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">NPS Responses</h1>
            <p className="text-muted-foreground">Loading responses...</p>
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-3 w-2/3 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NPS Responses</h1>
          <p className="text-muted-foreground">
            Detailed view of all NPS responses with AI analysis
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <MessageSquare className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* AI Explainer */}
      <AiExplainer compact />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search comments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Survey Type</label>
              <Select value={selectedSurvey} onValueChange={setSelectedSurvey}>
                <SelectTrigger>
                  <SelectValue placeholder="All surveys" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Surveys</SelectItem>
                  {availableSurveys.map((survey) => (
                    <SelectItem key={survey} value={survey}>
                      {survey}
                    </SelectItem>
                  ))}
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
                  {availableTitles.map((title) => (
                    <SelectItem key={title} value={title}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">NPS Bucket</label>
              <Select value={selectedNpsBucket} onValueChange={setSelectedNpsBucket}>
                <SelectTrigger>
                  <SelectValue placeholder="All buckets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buckets</SelectItem>
                  <SelectItem value="detractors">Detractors (0-6)</SelectItem>
                  <SelectItem value="passives">Passives (7-8)</SelectItem>
                  <SelectItem value="promoters">Promoters (9-10)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
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
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {startIndex + 1}-{Math.min(endIndex, filteredResponses.length)} of {filteredResponses.length} responses
        </p>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Responses Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Date</th>
                  <th className="text-left p-4 font-medium">Title</th>
                  <th className="text-left p-4 font-medium">Survey</th>
                  <th className="text-left p-4 font-medium">NPS</th>
                  <th className="text-left p-4 font-medium">Themes</th>
                  <th className="text-left p-4 font-medium">Sentiment</th>
                  <th className="text-left p-4 font-medium">Comment</th>
                  <th className="text-left p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentResponses.map((response) => (
                  <tr key={response.id} className="border-b hover:bg-muted/50">
                    <td className="p-4 text-sm">
                      {format(new Date(response.created_at), 'MMM dd, yyyy')}
                    </td>
                    <td className="p-4 text-sm font-medium">{response.title}</td>
                    <td className="p-4 text-sm">{response.survey_type}</td>
                    <td className="p-4">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant={getNpsBadgeVariant(response.nps_score)}>
                            {response.nps_score} - {getNpsBadgeText(response.nps_score)}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Promoters (9–10), Passives (7–8), Detractors (0–6). Deze indeling is de standaard NPS-methode.</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {response.themes.slice(0, 2).map((theme: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {theme.replace('_', ' ')}
                          </Badge>
                        ))}
                        {response.themes.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{response.themes.length - 2}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center space-x-2">
                            {getSentimentIcon(response.sentiment)}
                            <span className="text-sm font-mono">
                              {response.sentiment?.toFixed(2) ?? "—"}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>AI schat per opmerking hoe positief/negatief de toon is (-1..1). Dit staat los van de NPS-score.</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="p-4 max-w-xs">
                      <p className="text-sm line-clamp-2 text-muted-foreground">
                        {response.comment}
                      </p>
                    </td>
                    <td className="p-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openResponseDrawer(response)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Response Detail Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>Response Details</DrawerTitle>
          </DrawerHeader>
          {selectedResponse && (
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Basic Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date:</span>
                        <span>{format(new Date(selectedResponse.created_at), 'MMM dd, yyyy HH:mm')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Title:</span>
                        <span>{selectedResponse.title}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Survey:</span>
                        <span>{selectedResponse.survey_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">NPS Score:</span>
                        <Badge variant={getNpsBadgeVariant(selectedResponse.nps_score)}>
                          {selectedResponse.nps_score} - {getNpsBadgeText(selectedResponse.nps_score)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">AI Analysis</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sentiment:</span>
                        <div className="flex items-center space-x-2">
                          {getSentimentIcon(selectedResponse.sentiment)}
                          <Badge variant={getSentimentBadgeVariant(selectedResponse.sentiment)}>
                            {selectedResponse.sentiment_label}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Themes:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedResponse.themes.map((theme: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {theme}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Comment</h3>
                    <p className="text-sm bg-muted p-3 rounded-lg">
                      {selectedResponse.comment}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">Similar Responses</h3>
                    {loadingSimilar ? (
                      <div className="text-sm text-muted-foreground">Loading similar responses...</div>
                    ) : similarResponses.length > 0 ? (
                      <div className="space-y-2">
                        {similarResponses.map((similar, index) => (
                          <div key={index} className="text-sm bg-muted/50 p-3 rounded-lg">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium">{similar.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {Math.round(similar.similarity * 100)}% similar
                              </span>
                            </div>
                            <p className="text-muted-foreground text-xs mb-1">
                              NPS: {similar.nps_score} | {format(new Date(similar.created_at), 'MMM dd, yyyy')}
                            </p>
                            <p className="text-xs line-clamp-2">{similar.comment}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No similar responses found</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
    </TooltipProvider>
  )
}
