import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import AiExplainer from "@/components/AiExplainer";
import { getThemesAggregate, getThemesPromoterDetractor } from "@/lib/themes";

interface ThemesPageProps {
  searchParams: {
    start?: string;
    end?: string;
    survey?: string;
    title?: string;
    bucket?: "promoter" | "passive" | "detractor";
  };
}

export default async function ThemesPage({ searchParams }: ThemesPageProps) {
  // Get theme aggregation data with error handling
  let themeData = [];
  let promoterDetractorData = [];
  
  try {
    themeData = await getThemesAggregate({
      start: searchParams.start ?? undefined,
      end: searchParams.end ?? undefined,
      survey: searchParams.survey ?? null,
      title: searchParams.title ?? null,
      npsBucket: searchParams.bucket ?? null,
    });

    // Get promoter/detractor breakdown
    promoterDetractorData = await getThemesPromoterDetractor({
      start: searchParams.start ?? undefined,
      end: searchParams.end ?? undefined,
      survey: searchParams.survey ?? null,
      title: searchParams.title ?? null,
    });
  } catch (error) {
    console.error('Error fetching theme data:', error);
    // Use empty data as fallback
  }

  // Create a map for easy lookup
  const promoterDetractorMap = new Map(
    promoterDetractorData.map(item => [item.theme, item])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Thema Analyse</h1>
        <p className="text-muted-foreground">Ontdek welke onderwerpen het meest worden genoemd in NPS feedback</p>
      </div>
      
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Survey Type</label>
              <Select defaultValue={searchParams.survey ?? "all"}>
                <SelectTrigger>
                  <SelectValue placeholder="All surveys" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Surveys</SelectItem>
                  <SelectItem value="LLT_Nieuws">LLT Nieuws</SelectItem>
                  <SelectItem value="Customer_Service">Customer Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Title</label>
              <Select defaultValue={searchParams.title ?? "all"}>
                <SelectTrigger>
                  <SelectValue placeholder="All titles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Titles</SelectItem>
                  <SelectItem value="Trouw">Trouw</SelectItem>
                  <SelectItem value="Volkskrant">Volkskrant</SelectItem>
                  <SelectItem value="NRC">NRC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">NPS Bucket</label>
              <Select defaultValue={searchParams.bucket ?? "all"}>
                <SelectTrigger>
                  <SelectValue placeholder="All buckets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buckets</SelectItem>
                  <SelectItem value="detractor">Detractors (0-6)</SelectItem>
                  <SelectItem value="passive">Passives (7-8)</SelectItem>
                  <SelectItem value="promoter">Promoters (9-10)</SelectItem>
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
                      !searchParams.start && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {searchParams.start ? (
                      searchParams.end ? (
                        <>
                          {format(new Date(searchParams.start), "LLL dd, y")} -{" "}
                          {format(new Date(searchParams.end), "LLL dd, y")}
                        </>
                      ) : (
                        format(new Date(searchParams.start), "LLL dd, y")
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
                    defaultMonth={searchParams.start ? new Date(searchParams.start) : undefined}
                    selected={{
                      from: searchParams.start ? new Date(searchParams.start) : undefined,
                      to: searchParams.end ? new Date(searchParams.end) : undefined,
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themeData.map((t) => {
          const promoterDetractor = promoterDetractorMap.get(t.theme);
          return (
            <Card key={t.theme}>
              <CardHeader>
                <CardTitle className="capitalize">{t.theme.replace('_', ' ')}</CardTitle>
                <p className="text-xs text-muted-foreground">Het aandeel laat zien welk % van alle opmerkingen dit thema noemt.</p>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span><b>Volume:</b></span>
                  <span>{t.count_responses}</span>
                </div>
                <div className="flex justify-between">
                  <span><b>Aandeel:</b></span>
                  <span>{t.share_pct}%</span>
                </div>
                <div className="flex justify-between">
                  <span><b>Gem. sentiment:</b></span>
                  <span>{t.avg_sentiment?.toFixed(2) ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span><b>Gem. NPS:</b></span>
                  <span>{t.avg_nps?.toFixed(1) ?? "-"}</span>
                </div>
                {promoterDetractor && (
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-xs">
                      <span className="text-green-600">Promoters: {promoterDetractor.promoters}</span>
                      <span className="text-red-600">Detractors: {promoterDetractor.detractors}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {themeData.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Nog geen thema data beschikbaar. Upload eerst data en voer AI verrijking uit.</p>
            <p className="text-xs text-muted-foreground mt-2">Opmerkingen die leeg of 'n.v.t.' zijn, worden niet geclassificeerd.</p>
          </CardContent>
        </Card>
      )}
      
      {themeData.length > 0 && (
        <Card>
          <CardContent className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Aandeel is het percentage van alle thema-vermeldingen binnen de huidige filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
