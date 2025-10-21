"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Users, TrendingUp, TrendingDown, MessageSquare } from "lucide-react";

interface Theme {
  id: string;
  theme_name: string;
  mention_count: number;
  sentiment_score: number;
  sample_responses: string[];
}

interface CollapsibleSurveyThemesProps {
  themes: Theme[];
  maxVisible?: number;
}

export default function CollapsibleSurveyThemes({ 
  themes, 
  maxVisible = 5 
}: CollapsibleSurveyThemesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const visibleThemes = isExpanded ? themes : themes.slice(0, maxVisible);
  const hasMoreThemes = themes.length > maxVisible;

  const getSentimentColor = (score: number) => {
    if (score > 0.6) return "text-green-600";
    if (score < 0.4) return "text-red-600";
    return "text-yellow-600";
  };

  const getSentimentIcon = (score: number) => {
    if (score > 0.6) return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (score < 0.4) return <TrendingDown className="h-3 w-3 text-red-600" />;
    return <div className="h-3 w-3 rounded-full bg-yellow-600" />;
  };

  const getSentimentLabel = (score: number) => {
    if (score > 0.6) return "Positive";
    if (score < 0.4) return "Negative";
    return "Neutral";
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleThemes.map((theme, index) => (
          <Card key={theme.id} className="border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg font-semibold text-gray-900">
                  {theme.theme_name}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  #{index + 1}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {/* Metrics Row */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <div>
                      <div className="text-muted-foreground">Mentions</div>
                      <div className="font-semibold">{theme.mention_count}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSentimentIcon(theme.sentiment_score)}
                    <div>
                      <div className="text-muted-foreground">Sentiment</div>
                      <div className={`font-semibold ${getSentimentColor(theme.sentiment_score)}`}>
                        {getSentimentLabel(theme.sentiment_score)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sample Responses */}
                {theme.sample_responses && theme.sample_responses.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      Sample responses:
                    </div>
                    <div className="space-y-1">
                      {theme.sample_responses.slice(0, 2).map((response, idx) => (
                        <div key={idx} className="text-xs italic text-gray-600 line-clamp-2 bg-gray-50 p-2 rounded">
                          "{response}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Show More/Less Button */}
      {hasMoreThemes && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show All {themes.length} Themes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
