import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const slugify = (str: string) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD') // Remove accents
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/^-+|-+$/g, '');
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getPerformanceColor = (percentage: number | null | undefined, threshold: number = 100) => {
  if (percentage === null || percentage === undefined || isNaN(percentage) || !isFinite(percentage)) return '';
  if (percentage >= threshold) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  if (percentage >= threshold * 0.8) return 'text-amber-600 bg-amber-50 border-amber-100';
  return 'text-rose-600 bg-rose-50 border-rose-100';
};

export const getPerformanceBadgeColor = (percentage: number | null | undefined, threshold: number = 100) => {
  if (percentage === null || percentage === undefined || isNaN(percentage) || !isFinite(percentage)) return 'bg-zinc-200';
  if (percentage >= threshold) return 'bg-emerald-500';
  if (percentage >= threshold * 0.8) return 'bg-amber-500';
  return 'bg-rose-500';
};

export const getPerformanceTextColor = (percentage: number | null | undefined, threshold: number = 100) => {
  if (percentage === null || percentage === undefined || isNaN(percentage) || !isFinite(percentage)) return 'text-zinc-400';
  if (percentage >= threshold) return 'text-emerald-600';
  if (percentage >= threshold * 0.8) return 'text-amber-600';
  return 'text-rose-600';
};

export const formatNumber = (num: number) => {
  if (num < 0) {
    return `(${new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 2
    }).format(Math.abs(num))})`;
  }
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2
  }).format(num);
};

export const calculatePerformance = (actual: number, target: number) => {
  if (target === 0) return null;
  // Standard formula for performance that handles negative numbers
  // Performance = 1 + (Actual - Target) / |Target|
  return (1 + (actual - target) / Math.abs(target)) * 100;
};

export const formatPercent = (num: number | null | undefined) => {
  if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(num) + '%';
};
