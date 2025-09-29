"use client"

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface TrendsChartProps {
  data: Array<{
    month: Date;
    responses: number;
    nps: number;
  }>;
}

export function TrendsChart({ data }: TrendsChartProps) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">Geen trend data beschikbaar.</p>;
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="month" 
            tickFormatter={(value) => new Date(value).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })}
          />
          <YAxis />
          <Tooltip 
            labelFormatter={(value) => new Date(value).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
            formatter={(value: any) => [`${value}`, 'NPS Score']}
          />
          <Area 
            type="monotone" 
            dataKey="nps" 
            stroke="#8884d8" 
            fill="#8884d8" 
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
