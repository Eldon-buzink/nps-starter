import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Target, Lightbulb, Users } from "lucide-react";
import SubThemeDiscovery from './SubThemeDiscovery';

interface ThemeSummaryProps {
  theme: string;
  kpis: {
    current_nps: number;
    total_responses: number;
    promoters: number;
    passives: number;
    detractors: number;
    avg_score: number;
  };
  titles: Array<{
    title: string;
    total: number;
    nps: number;
    avg_score: number;
    promoters: number;
    detractors: number;
  }>;
  keyInsights: Array<{
    word: string;
    count: number;
  }>;
  responses: Array<{
    nps_score: number;
    nps_explanation: string;
    title_text: string;
  }>;
}

export default function ThemeSummary({ 
  theme, 
  kpis, 
  titles, 
  keyInsights,
  responses
}: ThemeSummaryProps) {
  
  // Calculate impact metrics
  const detractorPercentage = kpis.total_responses > 0 ? (kpis.detractors / kpis.total_responses) * 100 : 0;
  const promoterPercentage = kpis.total_responses > 0 ? (kpis.promoters / kpis.total_responses) * 100 : 0;
  
  // Get top affected titles
  const topAffectedTitles = titles.slice(0, 3);
  
  // Determine priority level
  const getPriorityLevel = () => {
    if (kpis.current_nps < -20 || detractorPercentage > 60) return 'critical';
    if (kpis.current_nps < 0 || detractorPercentage > 40) return 'high';
    if (kpis.current_nps < 20 || detractorPercentage > 25) return 'medium';
    return 'low';
  };
  
  const priorityLevel = getPriorityLevel();
  const priorityColors = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200'
  };
  
  // Generate actionable insights based on theme
  const getActionableInsights = () => {
    const insights = [];
    
    // Impact-based insights
    if (detractorPercentage > 50) {
      insights.push({
        type: 'impact',
        title: 'Hoge Detractor Impact',
        description: `${detractorPercentage.toFixed(1)}% van alle reacties zijn detractors`,
        action: 'Stel een klantherstelprogramma op voor de ${kpis.detractors} ontevreden klanten',
        reasoning: 'Hoge detractor-percentage wijst op systemische problemen die directe aandacht vereisen'
      });
    }
    
    // Title-specific insights
    if (topAffectedTitles.length > 0) {
      const topTitle = topAffectedTitles[0];
      insights.push({
        type: 'scope',
        title: 'Meest Getroffen Titel',
        description: `${topTitle.title} heeft ${topTitle.total} vermeldingen met ${topTitle.nps.toFixed(1)} NPS`,
        action: `Plan een klantentevredenheidsonderzoek specifiek voor ${topTitle.title} abonnees`,
        reasoning: 'Het aanpakken van de meest getroffen titel heeft de grootste impact op de algehele thema-prestaties'
      });
    }
    
    // Content-specific insights based on key words
    if (keyInsights.length > 0) {
      const topWords = keyInsights.slice(0, 3).map(k => k.word).join(', ');
      
      // Generate specific content actions based on the theme
      let specificAction = '';
      if (theme.includes('content') || theme.includes('kwaliteit')) {
        specificAction = `Verhoog de kwaliteit van artikelen over: ${topWords}. Plan een redactie-overleg om deze onderwerpen te bespreken`;
      } else if (theme.includes('delivery') || theme.includes('bezorging')) {
        specificAction = `Onderzoek bezorgproblemen rondom: ${topWords}. Contacteer bezorgpartners voor deze specifieke gebieden`;
      } else if (theme.includes('pricing') || theme.includes('prijs')) {
        specificAction = `Herzie prijsstrategie voor: ${topWords}. Analyseer concurrentieprijzen en overweeg kortingen`;
      } else if (theme.includes('support') || theme.includes('klantenservice')) {
        specificAction = `Verbeter klantenservice voor problemen met: ${topWords}. Train medewerkers op deze specifieke issues`;
      } else {
        specificAction = `Focus verbeteracties op: ${topWords}. Stel een werkgroep samen voor deze onderwerpen`;
      }
      
      insights.push({
        type: 'content',
        title: 'Belangrijkste Onderwerpen',
        description: `Meest genoemd: ${topWords}`,
        action: specificAction,
        reasoning: 'Dit zijn de specifieke gebieden waar klanten het meest over praten'
      });
    }
    
    // NPS-based insights
    if (kpis.current_nps < 0) {
      insights.push({
        type: 'nps',
        title: 'Negatieve NPS',
        description: `Huidige NPS: ${kpis.current_nps.toFixed(1)} (${kpis.detractors} detractors vs ${kpis.promoters} promoters)`,
        action: `Stuur een herstel-e-mail naar de ${kpis.detractors} detractors met een persoonlijk bericht van de hoofdredacteur`,
        reasoning: 'Negatieve NPS betekent dat meer klanten actief ontevreden zijn dan tevreden'
      });
    }
    
    return insights;
  };
  
  const actionableInsights = getActionableInsights();
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Executive Summary: {theme.replace('_', ' ')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Priority & Impact */}
        <div className="flex items-center gap-4">
          <Badge className={`${priorityColors[priorityLevel]} border`}>
            {priorityLevel.toUpperCase()} PRIORITY
          </Badge>
          <div className="text-sm text-muted-foreground">
            {kpis.total_responses} total responses • {detractorPercentage.toFixed(1)}% detractors
          </div>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{kpis.current_nps.toFixed(1)}</div>
            <div className="text-sm text-gray-600">NPS Score</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{kpis.detractors}</div>
            <div className="text-sm text-gray-600">Detractors</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{kpis.promoters}</div>
            <div className="text-sm text-gray-600">Promoters</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">{kpis.avg_score.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Avg Score</div>
          </div>
        </div>
        
        {/* Top Affected Titles */}
        {topAffectedTitles.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Most Affected Titles
            </h4>
            <div className="space-y-2">
              {topAffectedTitles.map((title, index) => (
                <div key={title.title} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="font-medium">{title.title}</span>
                  <div className="flex gap-4 text-sm">
                    <span>{title.total} mentions</span>
                    <span className={`font-medium ${title.nps < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {title.nps.toFixed(1)} NPS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Sub-Theme Discovery */}
        <SubThemeDiscovery theme={theme} responses={responses} />
        
        
      </CardContent>
    </Card>
  );
}
