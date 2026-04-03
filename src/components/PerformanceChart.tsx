import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
  ComposedChart,
  Line,
  LabelList
} from 'recharts';
import { MonthlyData } from '../types';
import { formatNumber, formatPercent } from '../utils';

interface ChartProps {
  data: MonthlyData[];
  title: string;
  type: 'monthly' | 'cumulative';
  compareWith: 'plan' | 'lastYear';
  selectedMonth?: number;
}

const monthMap: Record<string, string> = {
  'Jan': 'Tháng 1', 'Feb': 'Tháng 2', 'Mar': 'Tháng 3', 'Apr': 'Tháng 4',
  'May': 'Tháng 5', 'Jun': 'Tháng 6', 'Jul': 'Tháng 7', 'Aug': 'Tháng 8',
  'Sep': 'Tháng 9', 'Oct': 'Tháng 10', 'Nov': 'Tháng 11', 'Dec': 'Tháng 12',
  'Lũy kế': 'Lũy kế'
};

export const PerformanceChart: React.FC<ChartProps> = ({ data, title, type, compareWith, selectedMonth }) => {
  // 1. Filter data up to selected month
  const actualMonthsCount = selectedMonth !== undefined 
    ? selectedMonth + 1 
    : (() => {
        const lastActualIndex = [...data].reverse().findIndex(m => m.actual > 0);
        return lastActualIndex === -1 ? 0 : data.length - lastActualIndex;
      })();
  
  const filteredData = data.slice(0, actualMonthsCount);

  // 2. Prepare chart data with cumulative values
  const baseChartData = filteredData.reduce((acc: any[], curr, idx) => {
    const prev = acc[idx - 1] || { cumActual: 0, cumPlan: 0, cumLastYear: 0 };
    const cumActual = prev.cumActual + curr.actual;
    const cumPlan = prev.cumPlan + curr.plan;
    const cumLastYear = prev.cumLastYear + curr.lastYear;
    
    const target = compareWith === 'plan' ? curr.plan : curr.lastYear;
    const cumTarget = compareWith === 'plan' ? cumPlan : cumLastYear;

    acc.push({
      ...curr,
      target,
      cumActual,
      cumTarget,
      perf: target > 0 ? (curr.actual / target) * 100 : 0,
      cumPerf: cumTarget > 0 ? (cumActual / cumTarget) * 100 : 0
    });
    return acc;
  }, []);

  const isMonthly = type === 'monthly';
  const mainDataKey = isMonthly ? 'actual' : 'cumActual';
  const targetDataKey = isMonthly ? 'target' : 'cumTarget';
  const perfDataKey = isMonthly ? 'perf' : 'cumPerf';

  // 3. Add "Lũy kế" bar at the end for monthly view
  const chartData = [...baseChartData];
  if (isMonthly && baseChartData.length > 0) {
    const last = baseChartData[baseChartData.length - 1];
    chartData.push({
      month: 'Lũy kế',
      actual: last.cumActual,
      target: last.cumTarget,
      perf: last.cumPerf,
      isCumulative: true
    });
  }

  const getBarColor = (actual: number, target: number) => {
    if (target === 0) return '#18181b';
    const ratio = (actual / target) * 100;
    if (ratio >= 100) return '#6db33f'; // Vibrant Green
    if (ratio >= 80) return '#ffc000';  // Vibrant Yellow
    return '#ff0000'; // Vibrant Red
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-zinc-200 shadow-xl rounded-lg text-base">
          <p className="font-bold mb-2 text-zinc-800">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-zinc-500">{entry.name}:</span>
              </div>
              <span className="font-bold text-zinc-900">
                {entry.name.includes('%') ? formatPercent(entry.value) : formatNumber(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
      <h3 className="text-lg font-bold text-zinc-800 mb-4 uppercase tracking-tight">{title}</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 30, right: 10, left: 10, bottom: 10 }} barGap="-100%">
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#18181b', fontSize: 12, fontWeight: 'bold' }}
              tickFormatter={(val) => monthMap[val] || val}
              dy={5}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Target Bar (Plan/LastYear) - Wider */}
            <Bar 
              name={compareWith === 'plan' ? (isMonthly ? 'Kế hoạch' : 'KH Lũy kế') : (isMonthly ? 'Cùng kỳ' : 'CK Lũy kế')} 
              dataKey={targetDataKey} 
              fill="#f2f2f2" 
              radius={[2, 2, 0, 0]} 
              barSize={32}
            />
            
            {/* Actual Bar - Nested */}
            <Bar 
              name={isMonthly ? 'Thực tế' : 'Thực tế Lũy kế'} 
              dataKey={mainDataKey} 
              radius={[1, 1, 0, 0]} 
              barSize={20}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getBarColor(entry[mainDataKey], entry[targetDataKey])} 
                />
              ))}
              <LabelList 
                dataKey={perfDataKey} 
                content={(props: any) => {
                  const { x, y, width, value, index } = props;
                  if (value === undefined || value === null) return null;
                  const entry = chartData[index];
                  const color = getBarColor(entry[mainDataKey], entry[targetDataKey]);
                  return (
                    <text 
                      x={x + width / 2} 
                      y={y - 10} 
                      fill={color} 
                      textAnchor="middle" 
                      className="text-[11px] font-black"
                    >
                      {value.toFixed(0)}%
                    </text>
                  );
                }}
              />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
