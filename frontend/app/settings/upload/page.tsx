"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, Brain, AlertCircle, CheckCircle, XCircle, Database, FileText } from "lucide-react";
import SurveyHealth from "@/app/(dashboard)/settings/survey-health";

export default function SettingsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  async function onUpload() {
    if (!file) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus("Uploading...");
    
    const fd = new FormData();
    fd.append("file", file);
    
    try {
      const resp = await fetch(process.env.NEXT_PUBLIC_BACKEND_INGEST_URL ?? "/api/ingest", {
        method: "POST", 
        body: fd,
      });
      const json = await resp.json();
      
      if (resp.ok) {
        setUploadStatus(`Success! ${json.rows_inserted || 0} rows inserted.`);
        setUploadProgress(100);
      } else {
        setUploadStatus(`Error: ${json.error || 'Upload failed'}`);
      }
    } catch (error) {
      setUploadStatus(`Error: ${error}`);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Admin settings and data management</p>
      </div>

      {/* Data Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            Data Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input 
              type="file" 
              accept=".csv,.xlsx" 
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="mb-4"
            />
            <p className="text-sm text-muted-foreground mb-2">
              Upload CSV or XLSX files with NPS data
            </p>
            <p className="text-xs text-muted-foreground">
              Expected columns: NPS_SCORE, NPS_EXPLANATION, TITEL, SURVEY_TYPE, CREATIE_DT
            </p>
          </div>
          
          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          )}
          
          <Button 
            onClick={onUpload} 
            disabled={!file || isUploading}
            className="w-full"
          >
            {isUploading ? "Uploading..." : "Upload Data"}
          </Button>
          
          {uploadStatus && (
            <div className={`p-3 rounded-lg text-sm ${
              uploadStatus.includes('Success') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {uploadStatus}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Enrichment Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="h-5 w-5 mr-2" />
            AI Enrichment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">25,128</div>
              <div className="text-sm text-muted-foreground">Total Responses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">18,456</div>
              <div className="text-sm text-muted-foreground">With Comments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">73%</div>
              <div className="text-sm text-muted-foreground">Enriched</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Enrichment Coverage</span>
              <span>73%</span>
            </div>
            <Progress value={73} className="w-full" />
          </div>
          
          <Button 
            className="w-full" 
            variant="outline"
            disabled={isEnriching}
            onClick={async () => {
              setIsEnriching(true);
              try {
                const response = await fetch('/api/enrich', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                });
                const result = await response.json();
                if (response.ok) {
                  alert(`Enrichment completed! ${result.processed} responses processed, ${result.skipped_no_comment} skipped, ${result.failed} failed.`);
                } else {
                  alert(`Error: ${result.error}`);
                }
              } catch (error) {
                alert(`Error: ${error}`);
              } finally {
                setIsEnriching(false);
              }
            }}
          >
            {isEnriching ? "Running AI Enrichment..." : "Run Enrichment Now"}
          </Button>
          
          <div className="text-sm text-muted-foreground">
            Last run: 2 uur geleden • 1,234 responses processed
          </div>
        </CardContent>
      </Card>

      {/* Survey Health Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Survey Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SurveyHealth />
        </CardContent>
      </Card>

      {/* Data Quality Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Data Quality
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Invalid dates skipped</span>
              <Badge variant="secondary">2.3%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">'n.v.t.' comments</span>
              <Badge variant="secondary">15.7%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Missing titles</span>
              <Badge variant="destructive">0.8%</Badge>
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Top 3 titles with missing TITEL:</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>• Survey_2024_Q1 (45 missing)</div>
              <div>• Customer_Feedback_Jan (23 missing)</div>
              <div>• Exit_Survey_Dec (12 missing)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}