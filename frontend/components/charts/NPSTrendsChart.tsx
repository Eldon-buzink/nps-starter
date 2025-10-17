"use client";

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface NPSTrendsData {
  period: string;
  nps_score: number;
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
}

interface NPSTrendsChartProps {
  data: NPSTrendsData[];
  title: string;
  subtitle?: string;
  className?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border rounded-lg shadow-lg">
        <p className="font-semibold">{label}</p>
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            NPS Score: <span className="font-medium">{data.nps_score.toFixed(1)}</span>
          </p>
          <p className="text-gray-600">Responses: {data.responses}</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-green-600">Promoters: {data.promoters}</div>
            <div className="text-yellow-600">Passives: {data.passives}</div>
            <div className="text-red-600">Detractors: {data.detractors}</div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function NPSTrendsChart({ data, title, subtitle, className = "" }: NPSTrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`p-8 text-center text-gray-500 ${className}`}>
        <p className="text-sm">No NPS trend data available for the selected period.</p>
        <p className="text-xs mt-1">Try adjusting the date range or check if data exists for this title.</p>
      </div>
    );
  }

  // Calculate average NPS for reference line
  const avgNPS = data.reduce((sum, item) => sum + item.nps_score, 0) / data.length;

  // Determine trend direction
  const firstNPS = data[0]?.nps_score || 0;
  const lastNPS = data[data.length - 1]?.nps_score || 0;
  const trend = lastNPS > firstNPS ? 'up' : lastNPS < firstNPS ? 'down' : 'stable';
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';
  const trendIcon = trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '→';

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${trendColor}`}>
            {trendIcon} {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}
          </span>
          <span className="text-xs text-gray-500">
            Avg: {avgNPS.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="period" 
              stroke="#666"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#666"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={[0, 10]}
              tickCount={6}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Reference line for average NPS */}
            <ReferenceLine 
              y={avgNPS} 
              stroke="#94a3b8" 
              strokeDasharray="5 5" 
              strokeWidth={1}
              label={{ value: "Avg", position: "topRight", style: { fontSize: 12, fill: "#94a3b8" } }}
            />
            
            {/* NPS Score Line */}
            <Line
              type="monotone"
              dataKey="nps_score"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
