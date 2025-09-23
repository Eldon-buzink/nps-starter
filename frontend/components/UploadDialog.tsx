"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface UploadResult {
  inserted: number
  skipped: number
  errors: number
  errorDetails?: string[]
}

export function UploadDialog() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setProgress(0)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

          // Create AbortController for timeout
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minute timeout for large files

      // Simulate progress with more realistic increments for large files
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 10) return prev + 1
          if (prev < 30) return prev + 0.5
          if (prev < 80) return prev + 0.2
          return Math.min(prev + 0.1, 90)
        })
      }, 1000) // Slower updates for large files

      const response = await fetch('http://localhost:8001/ingest/', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      clearInterval(progressInterval)
      setProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Upload failed')
      }

      const data = await response.json()
      setResult(data)
      
      // Reset file after successful upload
      setTimeout(() => {
        setFile(null)
        setProgress(0)
        setResult(null)
        setOpen(false)
      }, 3000)

        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            setError('Upload timed out after 5 minutes. Large files may take longer to process. Please try again or contact support if the issue persists.')
          } else {
            setError(err instanceof Error ? err.message : 'Upload failed')
          }
          setProgress(0)
        } finally {
          setUploading(false)
        }
  }

  const resetUpload = () => {
    setFile(null)
    setProgress(0)
    setResult(null)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center space-x-2">
          <Upload className="h-4 w-4" />
          <span>Upload CSV Data</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload NPS Data</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!file && !uploading && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  Select a CSV or Excel file to upload
                </p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>
          )}

          {file && !uploading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetUpload}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex space-x-2">
                <Button onClick={handleUpload} className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
                <Button variant="outline" onClick={resetUpload}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {uploading && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-8 h-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Uploading and processing...</p>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {result && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="font-medium">Upload successful!</div>
                <div className="text-sm mt-1">
                  <div>✅ {result.inserted} rows inserted</div>
                  {result.skipped > 0 && <div>⚠️ {result.skipped} rows skipped</div>}
                  {result.errors > 0 && <div>❌ {result.errors} errors</div>}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="font-medium">Upload failed</div>
                <div className="text-sm mt-1">{error}</div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
