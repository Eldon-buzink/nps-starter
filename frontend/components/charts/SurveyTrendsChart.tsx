"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SurveyTrendsChartProps {
  data: Array<{
    month: string;
    survey: string;
    responses: number;
    nps: number;
  }>;
}

export function SurveyTrendsChart({ data }: SurveyTrendsChartProps) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">Geen survey data beschikbaar.</p>;
  }

  // Group data by month and create series for each survey
  const monthlyData = new Map<string, { [key: string]: number }>();
  const surveys = new Set<string>();

  data.forEach(item => {
    const month = item.month;
    if (!monthlyData.has(month)) {
      monthlyData.set(month, { month });
    }
    monthlyData.get(month)![item.survey] = item.nps;
    surveys.add(item.survey);
  });

  const chartData = Array.from(monthlyData.values())
    .map(item => {
      // Ensure proper date parsing for sorting
      const dateStr = item.month.includes('-') ? item.month : item.month + '-01';
      const date = new Date(dateStr);
      return {
        ...item,
        sortDate: date.getTime(),
        displayMonth: date.toLocaleDateString('nl-NL', { month: 'short' })
      };
    })
    .sort((a, b) => a.sortDate - b.sortDate);

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16'];

  return (
    <div className="h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="displayMonth"
            tick={{ fontSize: 12 }}
          />
          <YAxis />
          <Tooltip 
            labelFormatter={(value, payload) => {
              if (payload && payload[0]) {
                const data = payload[0].payload;
                return new Date(data.month + '-01').toLocaleDateString('nl-NL', { 
                  month: 'long', 
                  year: 'numeric' 
                });
              }
              return value;
            }}
            formatter={(value: any, name: string) => [`${value}`, name]}
          />
          <Legend />
          {Array.from(surveys).map((survey, index) => (
            <Line
              key={survey}
              type="monotone"
              dataKey={survey}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
