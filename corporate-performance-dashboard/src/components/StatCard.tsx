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
    <div className={cn("p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md", className)}>
      <div className="flex justify-between items-start mb-5">
        <div>
          <p className="text-lg font-medium text-zinc-500 mb-1.5">{title}</p>
          <h3 className="text-4xl font-bold text-zinc-900">{formatNumber(value)}</h3>
        </div>
        <div className={cn("px-3 py-1.5 rounded-full text-base font-bold border flex items-center gap-1.5", colorClass)}>
          {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {formatPercent(percentage)}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2 text-zinc-500">
            {type === 'plan' ? <Target size={18} /> : <Calendar size={18} />}
            <span>{type === 'plan' ? 'Kế hoạch' : 'Cùng kỳ'}</span>
          </div>
          <span className="font-bold text-zinc-700">{formatNumber(targetValue)}</span>
        </div>
        
        <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
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
