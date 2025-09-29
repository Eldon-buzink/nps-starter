"use client"

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';

interface TrendsOverviewChartProps {
  data: Array<{
    month: string;
    responses: number;
    nps: number;
  }>;
}

export function TrendsOverviewChart({ data }: TrendsOverviewChartProps) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">Geen trend data beschikbaar.</p>;
  }

  // Format data for the chart
  const chartData = data.map(item => ({
    month: new Date(item.month + '-01').toLocaleDateString('nl-NL', { month: 'short' }),
    fullMonth: item.month,
    responses: item.responses,
    nps: item.nps
  }));

  return (
    <div className="h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="month"
            tick={{ fontSize: 12 }}
          />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip 
            labelFormatter={(value, payload) => {
              if (payload && payload[0]) {
                return new Date(payload[0].payload.fullMonth + '-01').toLocaleDateString('nl-NL', { 
                  month: 'long', 
                  year: 'numeric' 
                });
              }
              return value;
            }}
            formatter={(value: any, name: string) => {
              if (name === 'NPS Score') {
                return [`${value}`, 'NPS Score'];
              }
              if (name === 'Responses') {
                return [`${value}`, 'Responses'];
              }
              return [value, name];
            }}
          />
          <Legend />
          <Bar 
            yAxisId="right"
            dataKey="responses" 
            fill="#e5e7eb" 
            name="Response Volume"
            radius={[2, 2, 0, 0]}
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="nps" 
            stroke="#3b82f6" 
            strokeWidth={3}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            name="NPS Score"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
