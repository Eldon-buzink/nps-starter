"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import Link from "next/link";

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
  const winners = data.filter(item => item.move === 'up');
  const losers = data.filter(item => item.move === 'down');

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
                <Link
                  key={`${item.title}-${index}`}
                  href={`/titles?title=${encodeURIComponent(item.title)}&start=2024-01-01&end=2025-12-31`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors block"
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
                </Link>
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
                <Link
                  key={`${item.title}-${index}`}
                  href={`/titles?title=${encodeURIComponent(item.title)}&start=2024-01-01&end=2025-12-31`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors block"
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
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              Geen dalers gevonden in de laatste maand
            </p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
