import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../utils';

interface MiniProgressProps {
  percentage: number | null | undefined;
  className?: string;
}

export const MiniProgress: React.FC<MiniProgressProps> = ({ percentage, className }) => {
  if (percentage === null || percentage === undefined || isNaN(percentage) || !isFinite(percentage)) return null;
  const cappedPercentage = Math.min(Math.max(percentage, 0), 100);
  
  let colorClass = "bg-rose-500";
  if (percentage >= 100) colorClass = "bg-emerald-500";
  else if (percentage >= 80) colorClass = "bg-amber-500";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex-shrink-0 h-1.5 w-8 bg-zinc-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${cappedPercentage}%` }}
          className={cn("h-full rounded-full", colorClass)}
        />
      </div>
      {percentage > 100 && (
        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
      )}
    </div>
  );
};
