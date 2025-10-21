"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Brain, BarChart3, Download, Share2 } from "lucide-react";
import Link from "next/link";
import { SurveyUpload } from "@/components/SurveyUpload";

export default function SurveyAnalysisPage() {
  const handleUploadComplete = (surveyId: string) => {
    // Redirect to processing page first, then to results when complete
    window.location.href = `/survey-analysis/processing/${surveyId}`;
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <FileText className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Survey Analysis</h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Upload any survey CSV file and get instant AI-powered insights, theme analysis, and actionable recommendations.
        </p>
      </div>

      {/* Upload Section */}
      <SurveyUpload onUploadComplete={handleUploadComplete} />

      {/* Features Preview */}
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <span>AI Theme Discovery</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Automatically identify key themes and patterns in your survey responses using advanced AI analysis.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              <span>Visual Insights</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Get interactive charts, word clouds, and sentiment analysis to understand your data at a glance.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Share2 className="h-5 w-5 text-orange-600" />
              <span>Easy Sharing</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Export to PDF, generate shareable links, or copy insights for presentations and reports.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Example Use Cases */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Perfect for Any Survey Type</CardTitle>
          <CardDescription>
            Our AI analysis works with any survey that includes open-ended responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Customer Feedback Surveys</h4>
              <p className="text-sm text-muted-foreground">
                Analyze customer satisfaction, product feedback, and service quality responses
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Employee Engagement</h4>
              <p className="text-sm text-muted-foreground">
                Understand employee sentiment, workplace issues, and improvement suggestions
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Market Research</h4>
              <p className="text-sm text-muted-foreground">
                Extract insights from focus group feedback, user interviews, and market studies
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Event Feedback</h4>
              <p className="text-sm text-muted-foreground">
                Analyze conference, workshop, or event feedback to improve future experiences
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="text-center">
        <p className="text-muted-foreground mb-4">
          Ready to analyze your survey data?
        </p>
        <Button size="lg" className="mr-4">
          <Upload className="h-4 w-4 mr-2" />
          Upload Your First Survey
        </Button>
        <Button variant="outline" size="lg">
          <Download className="h-4 w-4 mr-2" />
          Download Sample CSV
        </Button>
      </div>
    </div>
  );
}
