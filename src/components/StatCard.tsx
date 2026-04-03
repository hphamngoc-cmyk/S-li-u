import React from 'react';
import { TrendingUp, TrendingDown, Target, Calendar } from 'lucide-react';
import { cn, getPerformanceColor, formatNumber, formatPercent } from '../utils';

interface StatCardProps {
  title: string;
  value: number;
  targetValue: number;
  type: 'plan' | 'lastYear';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, targetValue, type, className }) => {
  const percentage = (value / targetValue) * 100;
  const colorClass = getPerformanceColor(percentage);
  const isPositive = percentage >= 100;

  return (
    <div className={cn("p-4 rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md", className)}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xs font-bold text-zinc-500 mb-0.5 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-zinc-900">{formatNumber(value)}</h3>
        </div>
        <div className={cn("px-2 py-1 rounded-full text-xs font-bold border flex items-center gap-1", colorClass)}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {formatPercent(percentage)}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
            {type === 'plan' ? <Target size={14} /> : <Calendar size={14} />}
            <span>{type === 'plan' ? 'Kế hoạch' : 'Cùng kỳ'}</span>
          </div>
          <span className="font-bold text-zinc-700">{formatNumber(targetValue)}</span>
        </div>
        
        <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-1000", 
              percentage >= 100 ? "bg-emerald-500" : percentage >= 80 ? "bg-amber-500" : "bg-rose-500"
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
