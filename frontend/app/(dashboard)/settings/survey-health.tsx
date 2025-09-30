'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Info, Loader2 } from 'lucide-react';

type AuditResult = {
  key: string;
  title: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  metric?: string | number;
  why?: string;
  how_to_fix?: string;
  category: 'data_quality' | 'strategy' | 'signal' | 'technical';
  severity: 'critical' | 'warning' | 'info';
};

export default function SurveyHealth() {
  const [items, setItems] = useState<AuditResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAudit = async () => {
    try {
      console.log('SurveyHealth: Starting audit fetch...');
      const response = await fetch('/api/nps/audit');
      console.log('SurveyHealth: Response status:', response.status);
      if (!response.ok) throw new Error('Failed to fetch audit');
      const data = await response.json();
      console.log('SurveyHealth: Received data:', data);
      setItems(data.results);
      console.log('SurveyHealth: Set items, count:', data.results?.length);
    } catch (error) {
      console.error('Error fetching audit:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    console.log('SurveyHealth: useEffect triggered');
    fetchAudit();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAudit();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">Running audit...</span>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="text-center py-8">
        <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-500">Audit failed. Please try again.</p>
        <Button onClick={handleRefresh} variant="outline" className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  const getStatusIcon = (status: AuditResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warn':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'skip':
        return <Info className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: AuditResult['status']) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case 'pass':
        return `${baseClasses} bg-green-100 text-green-700`;
      case 'warn':
        return `${baseClasses} bg-yellow-100 text-yellow-700`;
      case 'fail':
        return `${baseClasses} bg-red-100 text-red-700`;
      case 'skip':
        return `${baseClasses} bg-gray-100 text-gray-600`;
    }
  };

  const getCategoryIcon = (category: AuditResult['category']) => {
    switch (category) {
      case 'data_quality':
        return '📊';
      case 'strategy':
        return '🎯';
      case 'signal':
        return '📈';
      case 'technical':
        return '🔧';
    }
  };

  const getCategoryName = (category: AuditResult['category']) => {
    switch (category) {
      case 'data_quality':
        return 'Data Quality';
      case 'strategy':
        return 'Survey Strategy';
      case 'signal':
        return 'Signal Quality';
      case 'technical':
        return 'Technical Health';
    }
  };

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, AuditResult[]>);

  const getOverallScore = () => {
    const totalItems = items.filter(item => item.status !== 'skip').length;
    const passedItems = items.filter(item => item.status === 'pass').length;
    return totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;
  };

  const getCriticalIssues = () => {
    return items.filter(item => item.severity === 'critical' && item.status !== 'pass').length;
  };

  const getWarningIssues = () => {
    return items.filter(item => item.severity === 'warning' && item.status !== 'pass').length;
  };

  return (
    <div className="space-y-6">
      {/* Header with overall score */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Survey Health Dashboard</h3>
          <p className="text-sm text-muted-foreground">
            Automated checks for data quality, coverage, and timing
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Overall score card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Overall Score: {getOverallScore()}% (Good)
          </CardTitle>
          <CardDescription>
            {getCriticalIssues() > 0 && (
              <span className="text-red-600 font-medium">
                {getCriticalIssues()} critical issue{getCriticalIssues() !== 1 ? 's' : ''} need{getCriticalIssues() === 1 ? 's' : ''} attention
              </span>
            )}
            {getCriticalIssues() === 0 && getWarningIssues() > 0 && (
              <span className="text-yellow-600 font-medium">
                {getWarningIssues()} warning{getWarningIssues() !== 1 ? 's' : ''} to review
              </span>
            )}
            {getCriticalIssues() === 0 && getWarningIssues() === 0 && (
              <span className="text-green-600 font-medium">
                All checks passing! Your survey setup looks healthy.
              </span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Category sections */}
      {Object.entries(groupedItems).map(([category, categoryItems]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getCategoryIcon(category as AuditResult['category'])} {getCategoryName(category as AuditResult['category'])}
            </CardTitle>
            <CardDescription>
              {categoryItems.filter(item => item.status !== 'skip').length} checks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryItems.map((item) => (
                <div key={item.key} className="border rounded-lg p-4 flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(item.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{item.title}</h4>
                      <div className="flex items-center gap-2">
                        {item.metric && (
                          <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded">
                            {item.metric}
                          </span>
                        )}
                        <span className={getStatusBadge(item.status)}>
                          {item.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {item.why && (
                      <p className="text-sm text-muted-foreground mb-2">{item.why}</p>
                    )}
                    {item.how_to_fix && (
                      <div className="bg-blue-50 p-3 rounded-md">
                        <p className="text-sm">
                          <span className="font-medium text-blue-900">💡 How to fix:</span>
                          <span className="text-blue-800 ml-1">{item.how_to_fix}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
