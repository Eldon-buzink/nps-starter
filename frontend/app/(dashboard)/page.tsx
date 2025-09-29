import { getNpsSummary, getRecentResponses } from '@/lib/data';
import Link from 'next/link';

export default async function HomePage() {
  // Fetch basic data
  const [summary, recentResponses] = await Promise.all([
    getNpsSummary(),
    getRecentResponses(1000) // Get a large sample to calculate coverage
  ]);

  // Calculate coverage
  const totalResponses = summary?.total_responses || 0;
  const withComments = recentResponses.filter(r => r.nps_explanation && r.nps_explanation.trim() !== '').length;
  const coverage = {
    total_responses: totalResponses,
    with_comments: withComments
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">NPS Insights</h1>
        <p className="text-muted-foreground">
          Overzicht van uw NPS-prestaties en belangrijkste inzichten
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">NPS Score</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{summary?.nps_score || 'N/A'}</div>
              <p className="text-xs text-muted-foreground">
                Net Promoter Score
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Totaal Reacties</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{summary?.total_responses || 'N/A'}</div>
              <p className="text-xs text-muted-foreground">
                {coverage.with_comments} met opmerkingen
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Promoters</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">
                {summary?.total_responses ? Math.round((summary.promoters / summary.total_responses) * 100) : 'N/A'}%
              </div>
              <p className="text-xs text-muted-foreground">
                {summary?.promoters || 0} van {summary?.total_responses || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Detractors</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">
                {summary?.total_responses ? Math.round((summary.detractors / summary.total_responses) * 100) : 'N/A'}%
              </div>
              <p className="text-xs text-muted-foreground">
                {summary?.detractors || 0} van {summary?.total_responses || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Coverage */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <h3 className="text-lg font-semibold">Gegevensdekking</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {coverage.with_comments} van {coverage.total_responses} reacties hebben opmerkingen 
            ({coverage.total_responses ? Math.round((coverage.with_comments / coverage.total_responses) * 100) : 0}%)
          </p>
        </div>
      </div>

      {/* Top Themes */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Top Thema's</h3>
            <Link 
              href="/themes" 
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Bekijk alle thema's →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-sm text-muted-foreground">Content Kwaliteit</h4>
              <p className="text-2xl font-bold mt-1">48.4%</p>
              <p className="text-xs text-muted-foreground">614 reacties</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-sm text-muted-foreground">Overige</h4>
              <p className="text-2xl font-bold mt-1">24.5%</p>
              <p className="text-xs text-muted-foreground">311 reacties</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-sm text-muted-foreground">Pricing</h4>
              <p className="text-2xl font-bold mt-1">8.0%</p>
              <p className="text-xs text-muted-foreground">101 reacties</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}