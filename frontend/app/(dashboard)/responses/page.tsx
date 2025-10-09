import { createClient } from "@supabase/supabase-js";
import { getFilterOptions } from "@/lib/filters";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Search, Download, Eye } from "lucide-react";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper function to get a reasonable date range for the data
function getDefaultDateRange() {
  // Use a broader range that includes 2024-2025 to capture all data
  return {
    start: '2024-01-01',
    end: '2025-12-31'
  };
}

// Get responses data with filters
async function getResponses(params: {
  start?:string,
  end?:string,
  survey?:string|null,
  title?:string|null,
  search?:string|null,
  nps_bucket?:string|null,
  theme?:string|null,
  limit?:number,
  offset?:number
}) {
  try {
    let query = supabase
      .from('nps_response')
      .select(`
        id,
        created_at,
        title_text,
        survey_name,
        nps_score,
        nps_explanation,
        nps_ai_enrichment (
          themes,
          sentiment_score,
          sentiment_label
        )
      `)
      .gte('created_at', params.start || '2024-01-01')
      .lte('created_at', params.end || '2025-12-31')
      .order('created_at', { ascending: false });

    // Apply filters
    if (params.survey && params.survey !== 'all') {
      query = query.eq('survey_name', params.survey);
    }
    if (params.title && params.title !== 'all') {
      query = query.eq('title_text', params.title);
    }
    if (params.nps_bucket && params.nps_bucket !== 'all') {
      if (params.nps_bucket === 'promoter') {
        query = query.gte('nps_score', 9);
      } else if (params.nps_bucket === 'passive') {
        query = query.gte('nps_score', 7).lte('nps_score', 8);
      } else if (params.nps_bucket === 'detractor') {
        query = query.lte('nps_score', 6);
      }
    }
    if (params.search) {
      query = query.ilike('nps_explanation', `%${params.search}%`);
    }
    if (params.theme && params.theme !== 'all') {
      query = query.contains('nps_ai_enrichment.themes', [params.theme]);
    }

    // Apply pagination
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching responses:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getResponses:', error);
    return [];
  }
}

// Get available themes for filter
async function getAvailableThemes(params: {start?:string,end?:string,survey?:string|null,title?:string|null}) {
  try {
    const { data, error } = await supabase
      .from('nps_ai_enrichment')
      .select(`
        themes,
        nps_response!inner(creation_date)
      `)
      .not('themes', 'is', null)
      .gte('nps_response.creation_date', params.start || '2024-01-01')
      .lte('nps_response.creation_date', params.end || '2025-12-31');

    if (error) {
      console.error('Error fetching themes:', error);
      return [];
    }

    // Flatten and deduplicate themes
    const allThemes = new Set<string>();
    data?.forEach(row => {
      if (row.themes && Array.isArray(row.themes)) {
        row.themes.forEach((theme: string) => allThemes.add(theme));
      }
    });

    return Array.from(allThemes).sort();
  } catch (error) {
    console.error('Error in getAvailableThemes:', error);
    return [];
  }
}

// Get similar responses for a given response
async function getSimilarResponses(responseId: string, limit: number = 3) {
  try {
    const { data, error } = await supabase.rpc('similar_responses_for_response', {
      p_response_id: responseId,
      p_limit: limit
    });
    if (error) {
      console.error('Error fetching similar responses:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getSimilarResponses:', error);
    return [];
  }
}

interface ResponsesPageProps {
  searchParams: {
    start?: string;
    end?: string;
    survey?: string;
    title?: string;
    search?: string;
    nps_bucket?: string;
    theme?: string;
    page?: string;
  };
}

export default async function ResponsesPage({ searchParams }: ResponsesPageProps) {
  const { surveys, titles } = await getFilterOptions();
  
  // Use provided dates or default to full data range
  const defaultPeriod = getDefaultDateRange();
  const start = searchParams?.start ?? defaultPeriod.start;
  const end = searchParams?.end ?? defaultPeriod.end;
  const survey = searchParams?.survey ?? null;
  const title = searchParams?.title ?? null;
  const search = searchParams?.search ?? null;
  const nps_bucket = searchParams?.nps_bucket ?? null;
  const theme = searchParams?.theme ?? null;
  const page = parseInt(searchParams?.page || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  // Fetch data
  const [responses, availableThemes] = await Promise.all([
    getResponses({ start, end, survey, title, search, nps_bucket, theme, limit, offset }),
    getAvailableThemes({ start, end, survey, title })
  ]);

  const getNpsBadgeColor = (category: string) => {
    switch (category) {
      case 'promoter': return 'bg-green-100 text-green-800';
      case 'passive': return 'bg-yellow-100 text-yellow-800';
      case 'detractor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.1) return 'text-green-600';
    if (score < -0.1) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Responses</h1>
          <p className="text-muted-foreground">
            Audit en onderzoek opmerkingen; haal voorbeelden op voor rapporten; vergelijk vergelijkbare feedback.
          </p>
        </div>


        {/* Additional Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Verfijn je zoekopdracht met extra filters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/responses" method="GET" className="grid gap-4 md:grid-cols-6">
              {/* Hidden fields to preserve existing filters */}
              <input type="hidden" name="start" value={start} />
              <input type="hidden" name="end" value={end} />
              
              <div>
                <label className="block text-sm mb-1">Zoek in opmerkingen</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    name="search"
                    placeholder="Zoek in opmerkingen..."
                    className="pl-8"
                    defaultValue={search || ''}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm mb-1">Titel</label>
                <Select name="title" defaultValue={title || 'all'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle titels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle titels</SelectItem>
                    {titles.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm mb-1">Survey Type</label>
                <Select name="survey" defaultValue={survey || 'all'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle surveys" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle surveys</SelectItem>
                    {surveys.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm mb-1">NPS Categorie</label>
                <Select name="nps_bucket" defaultValue={nps_bucket || 'all'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle categorieën" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle categorieën</SelectItem>
                    <SelectItem value="promoter">Promoter (9-10)</SelectItem>
                    <SelectItem value="passive">Passive (7-8)</SelectItem>
                    <SelectItem value="detractor">Detractor (0-6)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm mb-1">Thema</label>
                <Select name="theme" defaultValue={theme || 'all'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle thema's" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle thema's</SelectItem>
                    {availableThemes.map(t => (
                      <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Button type="submit" className="w-full">Filters Toepassen</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Export Button */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {responses.length} van {responses.length} reacties getoond
          </div>
          <Button variant="outline" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export Huidige Weergave (CSV)</span>
          </Button>
        </div>

        {/* Responses Table */}
        <Card>
          <CardHeader>
            <CardTitle>Responses</CardTitle>
            <CardDescription>
              Klik op een reactie om details en vergelijkbare reacties te zien
            </CardDescription>
          </CardHeader>
          <CardContent>
            {responses.length > 0 ? (
              <div className="space-y-4">
                {responses.map((response: any) => (
                  <div key={response.id} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-4">
                          <Badge className={getNpsBadgeColor(response.nps_category)}>
                            {response.nps_score}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(response.creation_date).toLocaleDateString('nl-NL')}
                          </span>
                          <span className="text-sm font-medium">{response.title_text}</span>
                          <span className="text-sm text-muted-foreground">{response.survey_name}</span>
                        </div>
                        
                        {response.nps_ai_enrichment?.themes && response.nps_ai_enrichment.themes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {response.nps_ai_enrichment.themes.map((theme: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {theme.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {response.nps_explanation || 'Geen opmerking'}
                        </p>
                        
                        {response.nps_ai_enrichment?.sentiment_score !== null && response.nps_ai_enrichment?.sentiment_score !== undefined && (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-muted-foreground">Sentiment:</span>
                            <span className={`text-xs font-medium ${getSentimentColor(response.nps_ai_enrichment?.sentiment_score)}`}>
                              {response.nps_ai_enrichment?.sentiment_score?.toFixed(2)}
                            </span>
                            {response.nps_ai_enrichment?.sentiment_label && (
                              <Badge variant="outline" className="text-xs">
                                {response.nps_ai_enrichment.sentiment_label}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Geen reacties voor deze filters.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Probeer je filters aan te passen of upload meer data.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {responses.length === limit && (
          <div className="flex justify-center space-x-2">
            <Button variant="outline" disabled={page === 1}>
              Vorige
            </Button>
            <Button variant="outline">
              Volgende
            </Button>
          </div>
        )}
    </div>
  );
}