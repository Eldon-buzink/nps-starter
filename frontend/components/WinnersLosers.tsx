"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TrendingUp, TrendingDown, ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getTitleThemeDrivers } from "@/lib/winners-losers";
import { format } from "date-fns";

interface WinnersLosersProps {
  data: {
    month: string;
    title: string;
    responses: number;
    nps: number;
    mom_delta: number;
    move: 'up' | 'down';
  }[];
  minResponses: number;
}

export default function WinnersLosers({ data, minResponses }: WinnersLosersProps) {
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [themeDrivers, setThemeDrivers] = useState<any[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const winners = data.filter(item => item.move === 'up');
  const losers = data.filter(item => item.move === 'down');

  const handleTitleClick = async (title: string) => {
    setSelectedTitle(title);
    setLoadingDrivers(true);
    setIsDialogOpen(true);
    
    try {
      const drivers = await getTitleThemeDrivers({ title });
      setThemeDrivers(drivers);
    } catch (error) {
      console.error('Error loading theme drivers:', error);
      setThemeDrivers([]);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const getMoMIcon = (move: 'up' | 'down', delta: number) => {
    if (move === 'up') {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
  };

  const getMoMColor = (move: 'up' | 'down', delta: number) => {
    if (move === 'up') {
      return "text-green-600";
    } else {
      return "text-red-600";
    }
  };

  const formatDelta = (delta: number) => {
    return delta > 0 ? `+${delta}` : delta.toString();
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Winners */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span>Grootste NPS-stijgers (laatste maand)</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              We tonen alleen titels met ≥ {minResponses} reacties in de laatste maand om ruis te voorkomen.
            </p>
          </CardHeader>
          <CardContent>
            {winners.length > 0 ? (
              <div className="space-y-3">
                {winners.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleTitleClick(item.title)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {getMoMIcon(item.move, item.mom_delta)}
                        <span className="font-medium">{item.title}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Sample: {item.responses} reacties
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className={`font-mono font-bold ${getMoMColor(item.move, item.mom_delta)}`}>
                          MoM Δ {formatDelta(item.mom_delta)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          NPS: {item.nps}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Geen stijgers gevonden in de laatste maand
              </p>
            )}
          </CardContent>
        </Card>

        {/* Losers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <span>Grootste NPS-dalers (laatste maand)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {losers.length > 0 ? (
              <div className="space-y-3">
                {losers.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleTitleClick(item.title)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {getMoMIcon(item.move, item.mom_delta)}
                        <span className="font-medium">{item.title}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Sample: {item.responses} reacties
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className={`font-mono font-bold ${getMoMColor(item.move, item.mom_delta)}`}>
                          MoM Δ {formatDelta(item.mom_delta)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          NPS: {item.nps}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Geen dalers gevonden in de laatste maand
              </p>
            )}
          </CardContent>
        </Card>

        {/* Theme Drivers Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <span>Drivers van verandering: {selectedTitle}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>We tonen welke thema's in aandeel zijn gegroeid/gekrompen t.o.v. vorige maand voor deze titel. Dit verklaart (deels) de NPS-verschuiving.</p>
                  </TooltipContent>
                </Tooltip>
              </DialogTitle>
            </DialogHeader>
            
            {loadingDrivers ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Laden van thema drivers...</p>
              </div>
            ) : themeDrivers.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {themeDrivers.map((driver, index) => (
                    <Card key={`${driver.theme}-${driver.month}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm capitalize">
                          {driver.theme.replace('_', ' ')}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(driver.month), 'MMM yyyy')}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Aandeel:</span>
                          <span className="font-mono">{driver.share_pct}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Responses:</span>
                          <span className="font-mono">{driver.count_responses}</span>
                        </div>
                        {driver.mom_share_delta !== null && (
                          <div className="flex justify-between text-sm">
                            <span>MoM Δ:</span>
                            <span className={`font-mono ${
                              driver.mom_share_delta > 0 ? 'text-green-600' : 
                              driver.mom_share_delta < 0 ? 'text-red-600' : 'text-gray-500'
                            }`}>
                              {driver.mom_share_delta > 0 ? '+' : ''}{driver.mom_share_delta}%
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Geen thema drivers gevonden voor {selectedTitle}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
