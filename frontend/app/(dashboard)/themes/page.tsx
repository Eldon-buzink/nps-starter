"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getThemesAggregate } from "@/lib/themes-data";

export default function ThemesPage() {
  const [themeData, setThemeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSurvey, setSelectedSurvey] = useState('all');
  const [selectedTitle, setSelectedTitle] = useState('all');
  const [selectedBucket, setSelectedBucket] = useState('all');

  useEffect(() => {
    async function fetchThemeData() {
      try {
        setLoading(true);
        const data = await getThemesAggregate(
          undefined, // start date
          undefined, // end date
          selectedSurvey !== 'all' ? selectedSurvey : undefined,
          selectedTitle !== 'all' ? selectedTitle : undefined,
          selectedBucket !== 'all' ? selectedBucket : undefined
        );
        setThemeData(data);
      } catch (error) {
        console.error('Error fetching theme data:', error);
        setThemeData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchThemeData();
  }, [selectedSurvey, selectedTitle, selectedBucket]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thema Analyse</h1>
          <p className="text-muted-foreground">Loading theme data...</p>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Thema Analyse</h1>
        <p className="text-muted-foreground">Ontdek welke onderwerpen het meest worden genoemd in NPS feedback</p>
      </div>
      
      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Survey:</label>
          <Select value={selectedSurvey} onValueChange={setSelectedSurvey}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Surveys</SelectItem>
              <SelectItem value="ELT_Magazines">ELT Magazines</SelectItem>
              <SelectItem value="LLT_Nieuws">LLT Nieuws</SelectItem>
              <SelectItem value="LLT_Magazines">LLT Magazines</SelectItem>
              <SelectItem value="ELT_Nieuws">ELT Nieuws</SelectItem>
              <SelectItem value="EXIT_Nieuws">EXIT Nieuws</SelectItem>
              <SelectItem value="EXIT_Magazines">EXIT Magazines</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Title:</label>
          <Select value={selectedTitle} onValueChange={setSelectedTitle}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Titles</SelectItem>
              <SelectItem value="Trouw">Trouw</SelectItem>
              <SelectItem value="Donald Duck">Donald Duck</SelectItem>
              <SelectItem value="de Volkskrant">de Volkskrant</SelectItem>
              <SelectItem value="Het Laatste Nieuws">Het Laatste Nieuws</SelectItem>
              <SelectItem value="het AD">het AD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">NPS Bucket:</label>
          <Select value={selectedBucket} onValueChange={setSelectedBucket}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="promoter">Promoters</SelectItem>
              <SelectItem value="passive">Passives</SelectItem>
              <SelectItem value="detractor">Detractors</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themeData.length > 0 ? (
          themeData.map((t) => (
            <Card key={t.theme}>
              <CardHeader>
                <CardTitle className="capitalize">{t.theme.replace('_', ' ')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span><b>Volume:</b></span>
                  <span>{t.count_responses}</span>
                </div>
                <div className="flex justify-between">
                  <span><b>Aandeel:</b></span>
                  <span>{t.share_pct?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span><b>Gem. NPS:</b></span>
                  <span>{t.avg_nps?.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span><b>Sentiment:</b></span>
                  <span className={t.avg_sentiment > 0 ? 'text-green-600' : t.avg_sentiment < 0 ? 'text-red-600' : 'text-gray-600'}>
                    {t.avg_sentiment?.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">No theme data available. Run AI enrichment to analyze themes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
