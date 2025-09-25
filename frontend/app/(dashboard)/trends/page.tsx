import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Filter, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import AiExplainer from "@/components/AiExplainer";
import { getMonthlyTrends, getNpsByTitle } from "@/lib/data";

interface TrendsPageProps {
  searchParams: {
    start?: string;
    end?: string;
    survey?: string;
    title?: string;
  };
}

export default async function TrendsPage({ searchParams }: TrendsPageProps) {
  // Get real trend data
  const [monthlyTrends, titleData] = await Promise.all([
    getMonthlyTrends(searchParams.start, searchParams.end),
    getNpsByTitle()
  ]);

  // Transform monthly trends data
  const trendData = monthlyTrends.map(trend => ({
    month: trend.month,
    title: 'All Titles', // For now, show aggregate data
    nps_score: trend.nps_score,
    mom_delta: 0 // We don't have historical data for comparison yet
  }));

  // Group data by title for easier rendering
  const dataByTitle = trendData.reduce((acc, item) => {
    if (!acc[item.title]) {
      acc[item.title] = [];
    }
    acc[item.title].push(item);
    return acc;
  }, {} as Record<string, typeof trendData>);

  const getMoMIcon = (delta: number | null) => {
    if (delta === null) return <Minus className="h-4 w-4 text-gray-500" />;
    if (delta > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (delta < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getMoMColor = (delta: number | null) => {
    if (delta === null) return "text-gray-500";
    if (delta > 0) return "text-green-600";
    if (delta < 0) return "text-red-600";
    return "text-gray-500";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">NPS Trends</h1>
        <p className="text-muted-foreground">Maandelijkse NPS trends per merk met MoM (Month-over-Month) deltas</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      
      {/* Trends by Title */}
      <div className="space-y-6">
        {Object.entries(dataByTitle).map(([title, trends]) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{title}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {trends.length} maanden
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Maand</th>
                      <th className="text-right p-2 font-medium">Responses</th>
                      <th className="text-right p-2 font-medium">NPS Score</th>
                      <th className="text-right p-2 font-medium">MoM Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.map((trend) => (
                      <tr key={`${trend.month}-${trend.title}`} className="border-b">
                        <td className="p-2 text-sm">
                          {format(new Date(trend.month), "MMM yyyy")}
                        </td>
                        <td className="p-2 text-sm text-right">
                          {trend.responses}
                        </td>
                        <td className="p-2 text-sm text-right font-mono">
                          {trend.nps}
                        </td>
                        <td className="p-2 text-sm text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {getMoMIcon(trend.mom_delta)}
                            <span className={cn("font-mono", getMoMColor(trend.mom_delta))}>
                              {trend.mom_delta !== null ? 
                                (trend.mom_delta > 0 ? `+${trend.mom_delta}` : trend.mom_delta.toString()) 
                                : "—"
                              }
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {Object.keys(dataByTitle).length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Nog geen trend data beschikbaar. Upload eerst data en voer AI verrijking uit.</p>
            <p className="text-xs text-muted-foreground mt-2">Trends worden berekend op basis van maandelijkse NPS scores per merk.</p>
          </CardContent>
        </Card>
      )}
      
      {Object.keys(dataByTitle).length > 0 && (
        <Card>
          <CardContent className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              MoM Delta toont de verandering in NPS score ten opzichte van de vorige maand. 
              Groen = verbetering, Rood = verslechtering, Grijs = geen vorige maand beschikbaar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
