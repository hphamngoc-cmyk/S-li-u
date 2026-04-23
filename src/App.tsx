import React, { useState, useMemo, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { LayoutDashboard, ChevronDown, Filter, Info, Settings, Table as TableIcon, ArrowUpDown, ArrowUpNarrowWide, ArrowDownWideNarrow, X, Cloud, RefreshCw, ExternalLink, Download, Image as ImageIcon, Check, Copy, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';
import { dataService, GoogleSheetConfig } from './services/dataService';
import { DataEntry } from './components/DataEntry';
import { MiniProgress } from './components/MiniProgress';
import { DepartmentData } from './types';
import { cn, formatNumber, formatPercent, getPerformanceBadgeColor, calculatePerformance, getPerformanceTextColor, slugify } from './utils';

export default function App() {
  const [allDepts, setAllDepts] = useState<DepartmentData[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isDeptMenuOpen, setIsDeptMenuOpen] = useState(false);
  const [isMonthMenuOpen, setIsMonthMenuOpen] = useState(false);
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false);
  const [isDataEntryOpen, setIsDataEntryOpen] = useState(false);

  const [isYearManagementOpen, setIsYearManagementOpen] = useState(false);
  const [isGSheetModalOpen, setIsGSheetModalOpen] = useState(false);
  const [gsheetConfig, setGsheetConfig] = useState<GoogleSheetConfig | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    field: 'perfVsPlan' | 'monthPerfVsPlan' | 'annualCompletion';
    direction: 'asc' | 'desc';
  }>({ field: 'perfVsPlan', direction: 'desc' });
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [dashboardTab, setDashboardTab] = useState<'revenue' | 'profit' | 'product'>('revenue');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [visibleCharts, setVisibleCharts] = useState<Set<string>>(new Set());

  const PROFIT_INDICATORS = [
    { id: 'netRevenue', name: 'Doanh thu' },
    { id: 'expense', name: 'Chi phí' },
    { id: 'pbt', name: 'Lợi nhuận' },
    { id: 'ebitda', name: 'EBITDA' }
  ];

  const toggleChart = (id: string) => {
    setVisibleCharts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const CHART_COLORS = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
    '#6366f1', // indigo-500
    '#14b8a6', // teal-500
  ];

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('corporate_dashboard_columns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved columns', e);
      }
    }
    return {
      monthActual: true,
      monthPlan: true,
      monthPerfVsPlan: true,
      monthLastYear: true,
      monthPerfVsLastYear: true,
      actual: true,
      plan: true,
      perfVsPlan: true,
      lastYear: true,
      perfVsLastYear: true,
      annualPlan: true,
      annualCompletion: true,
    };
  });
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

  const COLUMN_CONFIG = [
    { id: 'monthActual', label: 'Thực tế', group: 'Tháng' },
    { id: 'monthPlan', label: 'KH', group: 'Tháng' },
    { id: 'monthPerfVsPlan', label: '% KH', group: 'Tháng' },
    { id: 'monthLastYear', label: 'Cùng kỳ', group: 'Tháng' },
    { id: 'monthPerfVsLastYear', label: '% CK', group: 'Tháng' },
    { id: 'actual', label: 'Thực tế', group: 'Lũy kế' },
    { id: 'plan', label: 'KH', group: 'Lũy kế' },
    { id: 'perfVsPlan', label: '% KH', group: 'Lũy kế' },
    { id: 'lastYear', label: 'Cùng kỳ', group: 'Lũy kế' },
    { id: 'perfVsLastYear', label: '% CK', group: 'Lũy kế' },
    { id: 'annualPlan', label: 'KH Năm', group: 'Năm' },
    { id: 'annualCompletion', label: '% HT', group: 'Năm' },
  ];

  const getVisibleCount = (group: string) => {
    return COLUMN_CONFIG.filter(c => c.group === group && visibleColumns[c.id]).length;
  };

  useEffect(() => {
    localStorage.setItem('corporate_dashboard_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const months = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setAvailableYears(dataService.getYears());
    setGsheetConfig(dataService.getGoogleSheetConfig());
  }, []);

  // Auto-sync effect
  useEffect(() => {
    if (gsheetConfig?.autoSync && gsheetConfig.sheetId) {
      const sync = async () => {
        try {
          await dataService.syncWithGoogleSheet();
          const updatedYears = dataService.getYears();
          setAvailableYears(updatedYears);
          const data = dataService.getData(selectedYear);
          setAllDepts(data);
          setGsheetConfig(dataService.getGoogleSheetConfig());
        } catch (e) {
          console.error('Auto-sync failed', e);
        }
      };
      sync();
    }
  }, [gsheetConfig?.autoSync]);

  useEffect(() => {
    const data = dataService.getData(selectedYear);
    setAllDepts(data);
    
    // Set default month to the latest month with actual data
    if (data.length > 0) {
      const company = data.find(d => d.type === 'company');
      if (company) {
        const reversedMonthly = [...company.monthly].reverse();
        const lastActualIndexFromEnd = reversedMonthly.findIndex(m => m.actual > 0);
        const defaultMonth = lastActualIndexFromEnd === -1 ? 0 : company.monthly.length - 1 - lastActualIndexFromEnd;
        setSelectedMonth(defaultMonth);
      }
    }
  }, [selectedYear]);

  const cumulativeOverview = useMemo(() => {
    return allDepts.map(dept => {
      const cum = dataService.calculateCumulative(dept.monthly, selectedMonth);
      const currentMonth = dept.monthly[selectedMonth];

      if (dashboardTab === 'profit') {
        const profitIndicators = PROFIT_INDICATORS.map(ind => {
          const actualField = `${ind.id}Actual` as keyof typeof cum;
          const planField = `${ind.id}Plan` as keyof typeof cum;
          const lastYearField = `${ind.id}LastYear` as keyof typeof cum;
          const annualPlanField = `annual${ind.id.charAt(0).toUpperCase() + ind.id.slice(1)}Plan` as keyof typeof cum;
          
          const mActual = (currentMonth as any)[actualField] || 0;
          const mPlan = (currentMonth as any)[planField] || 0;
          const mLastYear = (currentMonth as any)[lastYearField] || 0;
          
          const cActual = (cum as any)[actualField] || 0;
          const cPlan = (cum as any)[planField] || 0;
          const cLastYear = (cum as any)[lastYearField] || 0;
          const cAnnualPlan = (cum as any)[annualPlanField] || 0;

          return {
            id: ind.id,
            name: ind.name,
            monthActual: mActual,
            monthPlan: mPlan,
            monthLastYear: mLastYear,
            monthPerfVsPlan: calculatePerformance(mActual, mPlan),
            monthPerfVsLastYear: calculatePerformance(mActual, mLastYear),
            actual: cActual,
            plan: cPlan,
            lastYear: cLastYear,
            annualPlan: cAnnualPlan,
            perfVsPlan: calculatePerformance(cActual, cPlan),
            perfVsLastYear: calculatePerformance(cActual, cLastYear),
            annualCompletion: calculatePerformance(cActual, cAnnualPlan),
          };
        });

        return {
          ...dept,
          profitIndicators,
          // Monthly
          monthActual: currentMonth.profitActual || 0,
          monthPlan: currentMonth.profitPlan || 0,
          monthLastYear: currentMonth.profitLastYear || 0,
          monthPerfVsPlan: calculatePerformance(currentMonth.profitActual || 0, currentMonth.profitPlan || 0),
          monthPerfVsLastYear: calculatePerformance(currentMonth.profitActual || 0, currentMonth.profitLastYear || 0),
          // Cumulative
          actual: cum.profitActual || 0,
          plan: cum.profitPlan || 0,
          lastYear: cum.profitLastYear || 0,
          annualPlan: cum.annualProfitPlan || 0,
          perfVsPlan: calculatePerformance(cum.profitActual || 0, cum.profitPlan || 0),
          perfVsLastYear: calculatePerformance(cum.profitActual || 0, cum.profitLastYear || 0),
          annualCompletion: calculatePerformance(cum.profitActual || 0, cum.annualProfitPlan || 0),
        };
      }

      return {
        ...dept,
        // Monthly
        monthActual: currentMonth.actual,
        monthPlan: currentMonth.plan,
        monthLastYear: currentMonth.lastYear,
        monthPerfVsPlan: calculatePerformance(currentMonth.actual, currentMonth.plan),
        monthPerfVsLastYear: calculatePerformance(currentMonth.actual, currentMonth.lastYear),
        // Cumulative
        actual: cum.actual,
        plan: cum.plan,
        lastYear: cum.lastYear,
        annualPlan: cum.annualPlan,
        perfVsPlan: calculatePerformance(cum.actual, cum.plan),
        perfVsLastYear: calculatePerformance(cum.actual, cum.lastYear),
        annualCompletion: calculatePerformance(cum.actual, cum.annualPlan),
      };
    });
  }, [allDepts, selectedMonth, dashboardTab]);

  const sortedOverview = useMemo(() => {
    const company = cumulativeOverview.find(d => d.type === 'company');
    if (!company) return { bansSection: [], centersSection: [] };

    const sortFn = (a: any, b: any) => {
      const valA = a[sortConfig.field] || 0;
      const valB = b[sortConfig.field] || 0;
      return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
    };

    const bans = dashboardTab === 'revenue' 
      ? cumulativeOverview
          .filter(d => d.type === 'ban')
          .map(b => ({ ...b, indent: 1 }))
          .sort(sortFn)
      : [];

    const centerOrder = ['tmc', 'nura_hn', 'nura_hcm'];
    const centers = cumulativeOverview
      .filter(d => d.type === 'center')
      .map(c => ({
        ...c,
        indent: 1,
        phongs: dashboardTab === 'revenue' 
          ? cumulativeOverview
              .filter(p => p.parentId === c.id && p.type === 'phong')
              .map(p => ({ ...p, indent: 2 }))
              .sort(sortFn)
          : []
      }))
      .sort((a, b) => {
        const indexA = centerOrder.indexOf(a.id);
        const indexB = centerOrder.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return sortFn(a, b);
      });

    const products = dashboardTab === 'product'
      ? cumulativeOverview
          .filter(d => d.type === 'product' && d.parentId === 'tmc')
          .map(p => ({ ...p, indent: 1 }))
          .sort(sortFn)
      : [];

    const tmcCenter = cumulativeOverview.find(d => d.id === 'tmc');
    const tmcTotal = tmcCenter ? {
      ...tmcCenter,
      name: 'TỔNG DOANH THU TMC',
      type: 'company',
      // If we are in product tab, ensure the total matches the sum of products shown
      monthActual: dashboardTab === 'product' ? products.reduce((sum, p) => sum + p.monthActual, 0) : tmcCenter.monthActual,
      monthPlan: dashboardTab === 'product' ? products.reduce((sum, p) => sum + p.monthPlan, 0) : tmcCenter.monthPlan,
      monthLastYear: dashboardTab === 'product' ? products.reduce((sum, p) => sum + p.monthLastYear, 0) : tmcCenter.monthLastYear,
      actual: dashboardTab === 'product' ? products.reduce((sum, p) => sum + p.actual, 0) : tmcCenter.actual,
      plan: dashboardTab === 'product' ? products.reduce((sum, p) => sum + p.plan, 0) : tmcCenter.plan,
      lastYear: dashboardTab === 'product' ? products.reduce((sum, p) => sum + p.lastYear, 0) : tmcCenter.lastYear,
      annualPlan: dashboardTab === 'product' ? products.reduce((sum, p) => sum + p.annualPlan, 0) : tmcCenter.annualPlan,
    } : null;

    if (tmcTotal && dashboardTab === 'product') {
      const tt = tmcTotal as any;
      tt.monthPerfVsPlan = calculatePerformance(tt.monthActual, tt.monthPlan);
      tt.monthPerfVsLastYear = calculatePerformance(tt.monthActual, tt.monthLastYear);
      tt.perfVsPlan = calculatePerformance(tt.actual, tt.plan);
      tt.perfVsLastYear = calculatePerformance(tt.actual, tt.lastYear);
      tt.annualCompletion = calculatePerformance(tt.actual, tt.annualPlan);
    }

    // Calculate total for centers section
    const centersTotal = {
      id: 'centers_total',
      name: dashboardTab === 'profit' ? 'HỢP NHẤT CÔNG TY' : 'TỔNG TRUNG TÂM',
      type: 'company', // Use 'company' type for bold styling
      monthActual: dashboardTab === 'profit' ? (company?.monthActual || 0) : centers.reduce((sum, c) => sum + c.monthActual, 0),
      monthPlan: dashboardTab === 'profit' ? (company?.monthPlan || 0) : centers.reduce((sum, c) => sum + c.monthPlan, 0),
      monthLastYear: dashboardTab === 'profit' ? (company?.monthLastYear || 0) : centers.reduce((sum, c) => sum + c.monthLastYear, 0),
      actual: dashboardTab === 'profit' ? (company?.actual || 0) : centers.reduce((sum, c) => sum + c.actual, 0),
      plan: dashboardTab === 'profit' ? (company?.plan || 0) : centers.reduce((sum, c) => sum + c.plan, 0),
      lastYear: dashboardTab === 'profit' ? (company?.lastYear || 0) : centers.reduce((sum, c) => sum + c.lastYear, 0),
      annualPlan: dashboardTab === 'profit' ? (company?.annualPlan || 0) : centers.reduce((sum, c) => sum + c.annualPlan, 0),
      profitIndicators: company?.profitIndicators || [],
      monthly: dashboardTab === 'profit' 
        ? company?.monthly || []
        : months.map((month, index) => ({
            month,
            actual: centers.reduce((sum, c) => sum + (c.monthly[index]?.actual || 0), 0),
            plan: centers.reduce((sum, c) => sum + (c.monthly[index]?.plan || 0), 0),
            lastYear: centers.reduce((sum, c) => sum + (c.monthly[index]?.lastYear || 0), 0),
          }))
    };
    
    // Calculate percentages for centersTotal
    const ct = centersTotal as any;
    ct.monthPerfVsPlan = calculatePerformance(ct.monthActual, ct.monthPlan);
    ct.monthPerfVsLastYear = calculatePerformance(ct.monthActual, ct.monthLastYear);
    ct.perfVsPlan = calculatePerformance(ct.actual, ct.plan);
    ct.perfVsLastYear = calculatePerformance(ct.actual, ct.lastYear);
    ct.annualCompletion = calculatePerformance(ct.actual, ct.annualPlan);

    return {
      company,
      centersTotal: ct,
      tmcTotal,
      bansSection: [company, ...bans],
      centersSection: [ct, ...centers],
      productsSection: tmcTotal ? [tmcTotal, ...products] : products
    };
  }, [cumulativeOverview, sortConfig, dashboardTab]);

  const productChartData = useMemo(() => {
    if (dashboardTab !== 'product') return { month: [], cumulative: [] };
    
    const productsOnly = sortedOverview.productsSection.filter((p: any) => p.type !== 'company');
    
    const monthData = productsOnly.map((p: any) => ({
      name: p.name,
      value: p.monthActual || 0
    })).filter((d: any) => d.value > 0);

    const cumulativeData = productsOnly.map((p: any) => ({
      name: p.name,
      value: p.actual || 0
    })).filter((d: any) => d.value > 0);

    return { month: monthData, cumulative: cumulativeData };
  }, [sortedOverview.productsSection, dashboardTab]);

  const renderDataCells = (item: any, isBold: boolean = false) => {
    return (
      <React.Fragment>
        {/* Current Month */}
        {visibleColumns.monthActual && (
          <td className={cn("px-1 py-1.5 text-[13px] text-right", isBold ? "font-bold text-zinc-900" : "text-zinc-600")}>
            {formatNumber(item.monthActual)}
          </td>
        )}
        {visibleColumns.monthPlan && (
          <td className={cn("px-1 py-1.5 text-[13px] text-zinc-500 text-right", isBold ? "font-bold" : "text-zinc-400")}>
            {formatNumber(item.monthPlan)}
          </td>
        )}
        {visibleColumns.monthPerfVsPlan && (
          <td className="px-1 py-1.5">
            <div className="flex items-center gap-1 justify-end">
              <MiniProgress percentage={item.monthPerfVsPlan} />
              <span className={cn("text-[11px] font-bold min-w-[28px] text-right", 
                getPerformanceTextColor(item.monthPerfVsPlan)
              )}>
                {formatPercent(item.monthPerfVsPlan)}
              </span>
            </div>
          </td>
        )}
        {visibleColumns.monthLastYear && (
          <td className={cn("px-1 py-1.5 text-[13px] text-zinc-500 text-right", isBold ? "font-bold" : "text-zinc-400")}>
            {formatNumber(item.monthLastYear)}
          </td>
        )}
        {visibleColumns.monthPerfVsLastYear && (
          <td className="px-1 py-1.5 border-r border-zinc-100">
            <div className="flex items-center gap-1 justify-end">
              <MiniProgress percentage={item.monthPerfVsLastYear} />
              <span className={cn("text-[11px] font-bold min-w-[28px] text-right", 
                getPerformanceTextColor(item.monthPerfVsLastYear)
              )}>
                {formatPercent(item.monthPerfVsLastYear)}
              </span>
            </div>
          </td>
        )}
        
        {/* Cumulative */}
        {visibleColumns.actual && (
          <td className={cn("px-1 py-1.5 text-[13px] text-right", isBold ? "font-bold text-zinc-900 border-l border-zinc-100/10" : "text-zinc-600 border-l border-zinc-100/10")}>
            {formatNumber(item.actual)}
          </td>
        )}
        {visibleColumns.plan && (
          <td className={cn("px-1 py-1.5 text-[13px] text-zinc-500 text-right", isBold ? "font-bold" : "text-zinc-400")}>
            {formatNumber(item.plan)}
          </td>
        )}
        {visibleColumns.perfVsPlan && (
          <td className="px-1 py-1.5">
            <div className="flex items-center gap-1 justify-end">
              <MiniProgress percentage={item.perfVsPlan} />
              <span className={cn("text-[11px] font-bold min-w-[28px] text-right", 
                getPerformanceTextColor(item.perfVsPlan)
              )}>
                {formatPercent(item.perfVsPlan)}
              </span>
            </div>
          </td>
        )}
        {visibleColumns.lastYear && (
          <td className={cn("px-1 py-1.5 text-[13px] text-zinc-500 text-right", isBold ? "font-bold" : "text-zinc-400")}>
            {formatNumber(item.lastYear)}
          </td>
        )}
        {visibleColumns.perfVsLastYear && (
          <td className="px-1 py-1.5 border-r border-zinc-100">
            <div className="flex items-center gap-1 justify-end">
              <MiniProgress percentage={item.perfVsLastYear} />
              <span className={cn("text-[11px] font-bold min-w-[28px] text-right", 
                getPerformanceTextColor(item.perfVsLastYear)
              )}>
                {formatPercent(item.perfVsLastYear)}
              </span>
            </div>
          </td>
        )}
        
        {/* Annual */}
        {visibleColumns.annualPlan && (
          <td className={cn("px-1 py-1.5 text-[13px] text-zinc-500 text-right", isBold ? "font-bold" : "text-zinc-400")}>
            {formatNumber(item.annualPlan)}
          </td>
        )}
        {visibleColumns.annualCompletion && (
          <td className="px-1 py-1.5">
            <div className="flex items-center gap-1 justify-end">
              <MiniProgress percentage={item.annualCompletion} />
              <span className={cn("text-[11px] font-bold min-w-[28px] text-right", 
                getPerformanceTextColor(item.annualCompletion)
              )}>
                {formatPercent(item.annualCompletion)}
              </span>
            </div>
          </td>
        )}
      </React.Fragment>
    );
  };

  const renderDepartmentRowSet = (dept: any, options: { 
    isHeaderTotal?: boolean, 
    indent?: number, 
    showExpand?: boolean,
    isPhong?: boolean
  } = {}) => {
    const isProfitTab = dashboardTab === 'profit';
    const hasIndicators = isProfitTab && dept.profitIndicators && dept.profitIndicators.length > 0;
    
    // For non-profit or when indicators are not available, render a single row
    if (!hasIndicators) {
      return (
        <tr 
          key={dept.id}
          className={cn(
            options.isHeaderTotal ? "bg-zinc-50/30 font-bold" : "bg-white",
            options.isPhong ? "bg-zinc-50/10" : "",
            "group hover:bg-zinc-50/50 transition-colors cursor-pointer"
          )} 
          onClick={() => setSelectedDeptId(dept.id)}
        >
          <td className="px-1.5 py-1.5 border-r border-zinc-100">
            <div className={cn("flex items-center gap-2", 
              options.indent === 1 ? "pl-2" : options.indent === 2 ? "pl-6" : "pl-0"
            )}>
              {options.showExpand && (
                <button 
                  onClick={(e) => toggleExpand(dept.id, e)}
                  className="p-0.5 hover:bg-zinc-200 rounded transition-colors"
                >
                  <ChevronDown 
                    size={14} 
                    className={cn("text-zinc-900 transition-transform duration-200", 
                      !expandedDepts.has(dept.id) && "-rotate-90"
                    )} 
                  />
                </button>
              )}
              {!options.showExpand && <div className={cn("w-1 h-1 rounded-full", options.isHeaderTotal ? "bg-zinc-900" : "bg-zinc-300")} />}
              <span className={cn("text-[13px] truncate", 
                options.isHeaderTotal || (dept.type !== 'phong' && dept.type !== 'ban' && dept.type !== 'product') ? "font-bold text-zinc-900" : "text-zinc-600"
              )}>
                {dept.name}
              </span>
            </div>
          </td>
          {renderDataCells(dept, !!options.isHeaderTotal)}
        </tr>
      );
    }

    // Profit tab indicators rendering
    return (
      <React.Fragment key={dept.id}>
        {/* Header row for the department/center */}
        <tr className="bg-zinc-100/40 border-b border-zinc-200 group">
          <td 
            className="px-1.5 py-2 border-r border-zinc-200" 
            colSpan={1 + COLUMN_CONFIG.filter(c => visibleColumns[c.id]).length}
          >
            <div className="flex items-center justify-between">
              <div className={cn("flex items-center gap-2", options.indent === 1 ? "pl-2" : "pl-0")}>
                {options.showExpand && (
                  <button 
                    onClick={(e) => toggleExpand(dept.id, e)}
                    className="p-0.5 hover:bg-zinc-200 rounded transition-colors"
                  >
                    <ChevronDown 
                      size={14} 
                      className={cn("text-zinc-900 transition-transform duration-200", 
                        !expandedDepts.has(dept.id) && "-rotate-90"
                      )} 
                    />
                  </button>
                )}
                {!options.showExpand && <div className="w-1.5 h-1.5 rounded-full bg-zinc-900" />}
                <span className="text-[13px] text-zinc-900 font-bold uppercase tracking-[0.05em]">
                  {dept.name}
                </span>
              </div>
              {options.isHeaderTotal && (
                <div className="text-[10px] font-bold text-zinc-400 uppercase bg-white px-2 py-0.5 rounded-md border border-zinc-100 mr-2">
                  Hợp nhất
                </div>
              )}
            </div>
          </td>
        </tr>
        {/* The 4 indicators */}
        {dept.profitIndicators.map((ind: any) => (
          <tr 
            key={`${dept.id}-${ind.id}`} 
            className={cn(
              "hover:bg-zinc-50/50 transition-colors border-b border-zinc-50",
              (ind.id === 'pbt' || ind.id === 'ebitda') ? "bg-amber-50/5" : ""
            )}
          >
            <td className="px-1.5 py-1.5 border-r border-zinc-100 pl-8">
              <div className="flex items-center gap-2">
                <div className={cn("w-1 h-1 rounded-full", 
                  (ind.id === 'pbt' || ind.id === 'ebitda') ? "bg-amber-500" : "bg-zinc-300"
                )} />
                <span className={cn("text-[12px] truncate", 
                  (ind.id === 'pbt' || ind.id === 'ebitda') ? "font-bold text-zinc-800" : "text-zinc-500 font-medium"
                )}>
                  {ind.name}
                </span>
              </div>
            </td>
            {renderDataCells(ind, (ind.id === 'pbt' || ind.id === 'ebitda'))}
          </tr>
        ))}
      </React.Fragment>
    );
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, fill }: any) => {
    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    // Show all labels if percent is > 0.5%
    if (percent < 0.005) return null;

    // If slice is large enough, put label inside
    if (percent > 0.15) {
      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
      const x = cx + radius * cos;
      const y = cy + radius * sin;
      return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[10px] font-bold pointer-events-none">
          {`${(percent * 100).toFixed(0)}%`}
        </text>
      );
    }

    // Otherwise, put label outside with a line
    return (
      <g>
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill || CHART_COLORS[0]} fill="none" />
        <circle cx={ex} cy={ey} r={2} fill={fill || CHART_COLORS[0]} stroke="none" />
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" dominantBaseline="central" className="text-[10px] font-medium">
          {`${(percent * 100).toFixed(0)}%`}
        </text>
      </g>
    );
  };

  const DepartmentCharts = ({ dept, subDepts, title }: { dept: any, subDepts: any[], title: string }) => {
    const isVisible = visibleCharts.has(dept.id);
    
    const isProfit = dashboardTab === 'profit';

    const pieData = (subDepts || []).map(d => ({
      name: d.name,
      value: isProfit ? (d.profitActual || 0) : (d.actual || 0)
    })).filter(d => d.value > 0);

    const lineData = months.slice(0, selectedMonth + 1).map((m, idx) => {
      const monthData = dept.monthly?.[idx] || {};
      if (isProfit) {
        return {
          name: m,
          'Doanh thu': monthData.netRevenueActual || 0,
          'Chi phí': monthData.expenseActual || 0,
          'Lợi nhuận': monthData.pbtActual || monthData.profitActual || 0,
          'EBITDA': monthData.ebitdaActual || 0
        };
      }
      return {
        name: m,
        actual: monthData.actual || 0,
        plan: monthData.plan || 0,
        lastYear: monthData.lastYear || 0
      };
    });

    return (
      <div className="mt-4 space-y-4">
        <button 
          onClick={() => toggleChart(dept.id)}
          className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 transition-colors uppercase tracking-widest"
        >
          {isVisible ? <Minus size={14} /> : <Plus size={14} />}
          {isVisible ? 'Ẩn biểu đồ' : 'Xem biểu đồ'} {title}
        </button>

        <AnimatePresence>
          {isVisible && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={cn("grid gap-6 pb-6", isProfit ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
                {/* Pie Chart - Only for Revenue tab */}
                {!isProfit && (
                  <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">
                      Tỷ trọng doanh thu theo bộ phận
                    </h3>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={5}
                            dataKey="value"
                            label={renderCustomizedLabel}
                            labelLine={false}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val: number) => formatNumber(val)} />
                          <Legend 
                            verticalAlign="bottom" 
                            height={36} 
                            iconType="circle" 
                            formatter={(value) => <span className="text-[10px] font-medium text-zinc-600">{value}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Line Chart */}
                <div className={cn("bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm", isProfit && "w-full")}>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">
                    {isProfit ? 'Diễn biến các chỉ tiêu lợi nhuận' : 'Diễn biến doanh thu qua các tháng'}
                  </h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#999' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#999' }} tickFormatter={(val) => formatNumber(val)} />
                        <Tooltip formatter={(val: number) => formatNumber(val)} />
                        <Legend verticalAlign="top" align="right" iconType="circle" />
                        {isProfit ? (
                          <>
                            <Line type="monotone" dataKey="Doanh thu" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="Chi phí" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="Lợi nhuận" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="EBITDA" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                          </>
                        ) : (
                          <>
                            <Line type="monotone" dataKey="actual" name="Thực tế" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="plan" name="Kế hoạch" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#94a3b8' }} />
                            <Line type="monotone" dataKey="lastYear" name="Cùng kỳ" stroke="#cbd5e1" strokeWidth={2} dot={{ r: 3, fill: '#cbd5e1' }} />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Expand top-level departments by default
  useEffect(() => {
    if (sortedOverview.company?.id || sortedOverview.centersTotal?.id) {
      setExpandedDepts(prev => {
        const next = new Set(prev);
        if (sortedOverview.company?.id) next.add(sortedOverview.company.id);
        if (sortedOverview.centersTotal?.id) next.add(sortedOverview.centersTotal.id);
        return next;
      });
    }
  }, [sortedOverview.company?.id, sortedOverview.centersTotal?.id]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddYear = (yearToDeclare?: number) => {
    const nextYear = availableYears.length > 0 ? Math.min(...availableYears) - 1 : currentYear;
    const yearInput = yearToDeclare !== undefined ? yearToDeclare.toString() : prompt('Nhập năm muốn khai báo:', nextYear.toString());
    
    if (yearInput) {
      const year = parseInt(yearInput);
      if (isNaN(year)) {
        alert('Vui lòng nhập năm hợp lệ.');
        return;
      }
      if (year > currentYear) {
        alert(`Chỉ được khai báo tối đa đến năm hiện tại (${currentYear}).`);
        return;
      }
      dataService.addYear(year);
      const updatedYears = dataService.getYears();
      setAvailableYears(updatedYears);
      setSelectedYear(year);
      setIsYearMenuOpen(false);
    }
  };

  const handleDeleteYear = (year: number) => {
    if (confirm(`Bạn có chắc chắn muốn xóa toàn bộ dữ liệu của năm ${year}? Hành động này không thể hoàn tác.`)) {
      dataService.deleteYear(year);
      const updatedYears = dataService.getYears();
      setAvailableYears(updatedYears);
      if (selectedYear === year) {
        const newSelectedYear = updatedYears[0] || currentYear;
        setSelectedYear(newSelectedYear);
      }
      alert(`Đã xóa dữ liệu năm ${year}.`);
    }
  };

  const handleResetCurrentYear = () => {
    if (confirm(`Bạn có chắc chắn muốn RESET TOÀN BỘ dữ liệu của năm ${selectedYear}? \n\n- Tất cả số liệu đã nhập/đồng bộ sẽ bị xóa.\n- Dữ liệu sẽ quay về trạng thái trống (0).\n- Hành động này không thể hoàn tác.`)) {
      localStorage.removeItem(`corporate_dashboard_data_${selectedYear}`);
      const data = dataService.getData(selectedYear);
      setAllDepts(data);
      alert(`Đã reset dữ liệu năm ${selectedYear}.`);
    }
  };

  const handleClearAllData = () => {
    if (confirm('BẠN CÓ CHẮC CHẮN MUỐN XÓA TOÀN BỘ DỮ LIỆU CỦA TẤT CẢ CÁC NĂM? \n\n- Tất cả số liệu đã nhập sẽ bị mất.\n- Danh sách năm sẽ được reset về năm hiện tại.\n- Hành động này không thể hoàn tác.')) {
      dataService.clearAllData();
      const updatedYears = dataService.getYears();
      setAvailableYears(updatedYears);
      const newSelectedYear = updatedYears[0];
      setSelectedYear(newSelectedYear);
      const data = dataService.getData(newSelectedYear);
      setAllDepts(data);
      alert('Đã xóa toàn bộ dữ liệu và reset danh sách năm.');
      setIsYearManagementOpen(false);
    }
  };

  const handleSeedTestData = () => {
    if (confirm(`Bạn có muốn tạo dữ liệu mẫu cho năm ${selectedYear} để xem thử biểu đồ không? \n(Lưu ý: Dữ liệu hiện tại của năm này sẽ bị thay thế)`)) {
      const seededData = dataService.seedTestData(selectedYear);
      const storageKey = `corporate_dashboard_data_${selectedYear}`;
      localStorage.setItem(storageKey, JSON.stringify(seededData));
      setAllDepts(seededData);
      alert('Đã tạo dữ liệu mẫu thành công.');
      setIsYearMenuOpen(false);
    }
  };

  const handleSaveData = (newData: DepartmentData[]) => {
    const aggregatedData = dataService.saveData(newData, selectedYear);
    setAllDepts(aggregatedData);
    setIsDataEntryOpen(false);
  };

  const handleExportImage = async () => {
    if (selectedExportIds.length === 0) return;
    
    setIsExporting(true);
    // Small delay to ensure UI is settled
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // Create a main canvas for the 16:9 output
      const mainCanvas = document.createElement('canvas');
      mainCanvas.width = 1920;
      mainCanvas.height = 1080;
      const ctx = mainCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Fill background
      ctx.fillStyle = '#f9fafb'; // zinc-50
      ctx.fillRect(0, 0, 1920, 1080);

      // Draw Header
      ctx.fillStyle = '#18181b'; // zinc-900
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText(`Báo cáo Hiệu suất ${dashboardTab === 'revenue' ? 'Doanh thu' : 'Lợi nhuận'}`, 60, 100);
      
      ctx.fillStyle = '#71717a'; // zinc-500
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`${months[selectedMonth]} - Năm ${selectedYear}`, 60, 140);

      ctx.fillStyle = '#a1a1aa'; // zinc-400
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Xuất ngày: ${new Date().toLocaleDateString('vi-VN')}`, 1860, 140);
      ctx.textAlign = 'left';

      // Draw separator line
      ctx.strokeStyle = '#e4e4e7'; // zinc-200
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, 170);
      ctx.lineTo(1860, 170);
      ctx.stroke();

      // Capture each element as an image
      const images = [];
      for (const id of selectedExportIds) {
        const element = document.getElementById(id);
        if (element) {
          // Use toPng with some options for better reliability
          const dataUrl = await toPng(element, {
            backgroundColor: '#ffffff',
            quality: 1,
            pixelRatio: 2,
            cacheBust: true,
            style: {
              borderRadius: '0' // Ensure clean edges for the capture
            }
          });
          
          // Load the image
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = dataUrl;
          });
          images.push(img);
        }
      }

      if (images.length === 0) return;

      // Layout logic
      const padding = 60;
      const startY = 220;
      const availableWidth = 1920 - (padding * 2);
      const availableHeight = 1080 - startY - padding;

      if (images.length === 1) {
        const img = images[0];
        const ratio = img.width / img.height;
        let drawWidth = availableWidth;
        let drawHeight = drawWidth / ratio;

        if (drawHeight > availableHeight) {
          drawHeight = availableHeight;
          drawWidth = drawHeight * ratio;
        }

        const x = padding + (availableWidth - drawWidth) / 2;
        const y = startY + (availableHeight - drawHeight) / 2;
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
      } else {
        // Grid layout for multiple images
        const cols = 2;
        const rows = Math.ceil(images.length / cols);
        const cellWidth = (availableWidth - 40) / cols;
        const cellHeight = (availableHeight - (40 * (rows - 1))) / rows;

        images.forEach((img, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          
          const ratio = img.width / img.height;
          let drawWidth = cellWidth;
          let drawHeight = drawWidth / ratio;

          if (drawHeight > cellHeight) {
            drawHeight = cellHeight;
            drawWidth = drawHeight * ratio;
          }

          const x = padding + col * (cellWidth + 40) + (cellWidth - drawWidth) / 2;
          const y = startY + row * (cellHeight + 40) + (cellHeight - drawHeight) / 2;
          
          // Add a small shadow/border for each table
          ctx.shadowColor = 'rgba(0,0,0,0.1)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, drawWidth, drawHeight);
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          
          ctx.drawImage(img, x, y, drawWidth, drawHeight);
          
          // Border
          ctx.strokeStyle = '#e4e4e7';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, drawWidth, drawHeight);
        });
      }

      // Export
      const finalDataUrl = mainCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Bao-cao-${dashboardTab}-${selectedYear}-${selectedMonth + 1}.png`;
      link.href = finalDataUrl;
      link.click();
      
      setIsExportModalOpen(false);
    } catch (err) {
      console.error('Export failed', err);
      alert('Có lỗi xảy ra khi xuất ảnh. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSyncGSheet = async () => {
    const sheetId = dashboardTab === 'revenue' 
      ? gsheetConfig?.sheetId 
      : dashboardTab === 'profit' 
        ? gsheetConfig?.profitSheetId 
        : gsheetConfig?.productSheetId;
    if (!sheetId) return;
    
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      await dataService.syncWithGoogleSheet(dashboardTab);
      const updatedYears = dataService.getYears();
      setAvailableYears(updatedYears);
      const data = dataService.getData(selectedYear);
      setAllDepts(data);
      setGsheetConfig(dataService.getGoogleSheetConfig());
      const tabName = dashboardTab === 'revenue' ? 'Doanh thu' : dashboardTab === 'profit' ? 'Lợi nhuận' : 'Sản phẩm';
      setSyncStatus({ 
        type: 'success', 
        message: `Đồng bộ dữ liệu ${tabName} thành công!` 
      });
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (error: any) {
      setSyncStatus({ 
        type: 'error', 
        message: error.message || 'Đồng bộ thất bại. Vui lòng kiểm tra lại ID và quyền chia sẻ.' 
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadGSheetTemplate = () => {
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let headers: string[] = [];
    let data: any[] = [];

    if (dashboardTab === 'profit') {
      headers = [
        'Year', 'DeptID', 'Month', 
        'NetRevenueActual', 'NetRevenuePlan', 'NetRevenueLastYear',
        'ExpenseActual', 'ExpensePlan', 'ExpenseLastYear',
        'PBTActual', 'PBTPlan', 'PBTLastYear',
        'EBITDAActual', 'EBITDAPlan', 'EBITDALastYear',
        'AnnualNetRevenuePlan', 'AnnualExpensePlan', 'AnnualPBTPlan', 'AnnualEBITDAPlan',
        'Name'
      ];
      // For profit, include Company and Centers - sorted
      const profitDepts: DepartmentData[] = [];
      const company = allDepts.find(d => d.type === 'company');
      if (company) profitDepts.push(company);
      const centers = allDepts.filter(d => d.type === 'center');
      profitDepts.push(...centers);

      profitDepts.forEach(dept => {
        let displayId = dept.id;
        if (dept.id.startsWith('dept_') || dept.id.startsWith('prod_')) {
          const nameSlug = slugify(dept.name);
          if (dept.type === 'company' || dept.type === 'center' || dept.type === 'ban') {
            displayId = nameSlug;
          } else if (dept.type === 'phong') {
            const parent = allDepts.find(p => p.id === dept.parentId);
            const parentIdSlug = parent ? (parent.id.startsWith('dept_') ? slugify(parent.name) : parent.id) : 'all';
            
            if (nameSlug.startsWith(parentIdSlug + '_')) {
              displayId = nameSlug;
            } else {
              displayId = `${parentIdSlug}_${nameSlug}`;
            }
          }
        }

        monthsShort.forEach(m => {
          const row: any = {
            'Year': selectedYear,
            'DeptID': displayId,
            'Month': m,
            'Name': dept.name
          };
          // Initialize indicators
          headers.forEach(h => {
            if (!row[h] && h !== 'Name') row[h] = 0;
          });
          data.push(row);
        });
      });
    } else if (dashboardTab === 'product') {
      headers = ['Year', 'DeptID', 'Month', 'Actual', 'Plan', 'LastYear', 'Name'];
      // For product, include only products
      const productDepts = allDepts.filter(d => d.type === 'product');
      productDepts.forEach(dept => {
        let displayId = dept.id;
        if (dept.id.startsWith('dept_') || dept.id.startsWith('prod_')) {
          displayId = `prod_${slugify(dept.name)}`;
        }
        monthsShort.forEach(m => {
          data.push({
            'Year': selectedYear,
            'DeptID': displayId,
            'Month': m,
            'Actual': 0,
            'Plan': 0,
            'LastYear': 0,
            'Name': dept.name
          });
        });
      });
    } else {
      headers = ['Year', 'DeptID', 'Month', 'Actual', 'Plan', 'LastYear', 'Name'];
      
      // Follow the same hierarchy as DataEntry.tsx for revenue sorting
      const exportList: DepartmentData[] = [];
      const company = allDepts.find(d => d.type === 'company');
      if (company) exportList.push(company);
      
      // 1. Bans directly under company
      const bans = allDepts.filter(d => d.type === 'ban');
      exportList.push(...bans);

      // 2. Centers
      const centers = allDepts.filter(d => d.type === 'center');
      centers.forEach(center => {
        exportList.push(center);
        
        // 3. Phongs belonging to center
        const phongs = allDepts.filter(d => d.parentId === center.id && d.type === 'phong');
        
        // Add prefix for phongs to identify their center in the Name column
        const phongsWithPrefix = phongs.map(p => ({
          ...p,
          name: `${center.name} - ${p.name}`
        }));
        
        exportList.push(...phongsWithPrefix);

        // 4. Products if TMC
        if (center.id === 'tmc') {
          const tmcProds = allDepts.filter(d => d.type === 'product' && d.parentId === 'tmc');
          exportList.push(...tmcProds);
        }
      });

      exportList.forEach(dept => {
        let displayId = dept.id;
        if (dept.id.startsWith('dept_') || dept.id.startsWith('prod_')) {
          const nameSlug = slugify(dept.name);
          if (dept.type === 'ban' || dept.type === 'center' || dept.type === 'company') {
            displayId = nameSlug;
          } else if (dept.type === 'phong') {
             const parentCenter = allDepts.find(c => c.id === dept.parentId);
             const parentIdSlug = parentCenter ? (parentCenter.id.startsWith('dept_') ? slugify(parentCenter.name) : parentCenter.id) : 'all';
             
             // Prevent double prefixing if name already contains parent slug
             if (nameSlug.startsWith(parentIdSlug + '_')) {
               displayId = nameSlug;
             } else if (nameSlug === parentIdSlug) {
               displayId = nameSlug;
             } else {
               displayId = `${parentIdSlug}_${nameSlug}`;
             }
          } else if (dept.type === 'product') {
            displayId = `prod_${nameSlug}`;
          }
        }
        
        monthsShort.forEach(m => {
          data.push({
            'Year': selectedYear,
            'DeptID': displayId,
            'Month': m,
            'Actual': 0,
            'Plan': 0,
            'LastYear': 0,
            'Name': dept.name
          });
        });
      });
    }

    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `Google_Sheet_Template_${dashboardTab === 'revenue' ? 'DoanhThu' : dashboardTab === 'profit' ? 'LoiNhuan' : 'SanPham'}_${selectedYear}.xlsx`);
  };

  if (allDepts.length === 0) return null;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-200">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 py-2">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white shadow-lg">
              <LayoutDashboard size={16} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Dashboard Hiệu Suất</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Corporate Performance Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm font-bold text-zinc-700 hover:border-zinc-400 transition-all shadow-sm"
            >
              <ImageIcon size={16} className="text-zinc-400" />
              <span className="hidden sm:inline">Xuất ảnh</span>
            </button>

            {/* Year Selector */}
            <div className="relative">
              <button 
                onClick={() => setIsYearMenuOpen(!isYearMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm font-bold text-zinc-700 hover:border-zinc-400 transition-all shadow-sm"
              >
                <Settings size={16} className="text-zinc-400" />
                <span>Năm {selectedYear}</span>
                <ChevronDown size={16} className={cn("text-zinc-400 transition-transform", isYearMenuOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isYearMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 w-56 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="max-h-64 overflow-y-auto border-b border-zinc-100">
                      {availableYears.map((year) => (
                        <button
                          key={year}
                          onClick={() => {
                            setSelectedYear(year);
                            setIsYearMenuOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left transition-colors flex items-center justify-between",
                            selectedYear === year ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                          )}
                        >
                          <span className="text-[11px] font-bold">Năm {year}</span>
                          {year === currentYear && (
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter",
                              selectedYear === year ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                            )}>
                              Hiện tại
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="p-2 space-y-1">
                      <button
                        onClick={handleAddYear}
                        className="w-full px-3 py-2 text-left text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Settings size={14} />
                        Thêm năm khai báo
                      </button>
                      <button
                        onClick={handleSeedTestData}
                        className="w-full px-3 py-2 text-left text-xs font-bold text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Settings size={14} />
                        Dùng dữ liệu mẫu
                      </button>
                      <button
                        onClick={handleClearAllData}
                        className="w-full px-3 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Settings size={14} />
                        Xóa toàn bộ dữ liệu
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Month Selector */}
            <div className="relative">
              <button 
                onClick={() => setIsMonthMenuOpen(!isMonthMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm font-bold text-zinc-700 hover:border-zinc-400 transition-all shadow-sm"
              >
                <Filter size={16} className="text-zinc-400" />
                <span>{months[selectedMonth]}</span>
                <ChevronDown size={16} className={cn("text-zinc-400 transition-transform", isMonthMenuOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isMonthMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 w-48 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="max-h-64 overflow-y-auto">
                      {months.map((month, index) => (
                        <button
                          key={month}
                          onClick={() => {
                            setSelectedMonth(index);
                            setIsMonthMenuOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-[11px] font-bold transition-colors hover:bg-zinc-50",
                            selectedMonth === index ? "text-blue-600 bg-blue-50/50" : "text-zinc-600"
                          )}
                        >
                          {month}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => setIsYearManagementOpen(true)}
              className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 transition-all shadow-sm"
              title="Quản lý năm & Dữ liệu"
            >
              <Settings size={18} />
            </button>

            <button 
              onClick={() => setIsGSheetModalOpen(true)}
              className={cn(
                "p-2 border rounded-lg transition-all shadow-sm flex items-center gap-1.5",
                (dashboardTab === 'revenue' ? gsheetConfig?.sheetId : dashboardTab === 'profit' ? gsheetConfig?.profitSheetId : gsheetConfig?.productSheetId)
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100" 
                  : "bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-400"
              )}
              title={`Kết nối Google Sheets (${dashboardTab === 'revenue' ? 'Doanh thu' : dashboardTab === 'profit' ? 'Lợi nhuận' : 'Sản phẩm'})`}
            >
              <Cloud size={18} />
              {(dashboardTab === 'revenue' ? gsheetConfig?.sheetId : dashboardTab === 'profit' ? gsheetConfig?.profitSheetId : gsheetConfig?.productSheetId) && <span className="text-[10px] font-bold">Linked</span>}
            </button>

            <button 
              onClick={() => setIsDataEntryOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 text-white rounded-lg text-sm font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
            >
              <TableIcon size={16} />
              <span>Khai báo số liệu</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg w-fit">
          <button
            onClick={() => setDashboardTab('revenue')}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-bold transition-all",
              dashboardTab === 'revenue' 
                ? "bg-white text-zinc-900 shadow-sm" 
                : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            Doanh thu
          </button>
          <button
            onClick={() => setDashboardTab('profit')}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-bold transition-all",
              dashboardTab === 'profit' 
                ? "bg-white text-zinc-900 shadow-sm" 
                : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            Lợi nhuận
          </button>
          <button
            onClick={() => setDashboardTab('product')}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-bold transition-all",
              dashboardTab === 'product' 
                ? "bg-white text-zinc-900 shadow-sm" 
                : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            Sản phẩm TMC
          </button>
        </div>

        {/* Legend / Info */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-2.5 bg-white border border-zinc-200 rounded-xl shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              <Info size={14} />
              <span>Chỉ số màu sắc:</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold">≥ 100% (Đạt)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs font-bold">80% - 99% (Cảnh báo)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-xs font-bold">&lt; 80% (Kém)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-l border-zinc-100 pl-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              <ArrowUpDown size={14} />
              <span>Sắp xếp:</span>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[11px] font-bold text-zinc-700 hover:border-zinc-400 transition-all"
              >
                {sortConfig.field === 'monthPerfVsPlan' ? '% KH Tháng' : 
                 sortConfig.field === 'perfVsPlan' ? '% KH Lũy kế' : 
                 '% HT KH Năm'}
                <ChevronDown size={14} className={cn("text-zinc-400 transition-transform", isSortMenuOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isSortMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-1">
                      {[
                        { id: 'monthPerfVsPlan', label: '% KH Tháng' },
                        { id: 'perfVsPlan', label: '% KH Lũy kế' },
                        { id: 'annualCompletion', label: '% HT KH Năm' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSortConfig({ ...sortConfig, field: item.id as any });
                            setIsSortMenuOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-[11px] font-bold transition-colors rounded-lg",
                            sortConfig.field === item.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'desc' ? 'asc' : 'desc' })}
              className="p-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 transition-all shadow-sm"
              title={sortConfig.direction === 'desc' ? "Sắp xếp giảm dần" : "Sắp xếp tăng dần"}
            >
              {sortConfig.direction === 'desc' ? (
                <ArrowDownWideNarrow size={16} />
              ) : (
                <ArrowUpNarrowWide size={16} />
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                className="p-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 transition-all shadow-sm"
                title="Tùy chỉnh cột hiển thị"
              >
                <Settings size={16} />
              </button>

              <AnimatePresence>
                {isColumnMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-2 w-64 bg-white border border-zinc-200 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Hiển thị cột</h3>
                    </div>
                    <div className="p-2 max-h-[400px] overflow-y-auto">
                      {['Tháng', 'Lũy kế', 'Năm'].map(group => (
                        <div key={group} className="mb-3 last:mb-0">
                          <div className="px-3 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{group}</div>
                          <div className="space-y-1">
                            {COLUMN_CONFIG.filter(c => c.group === group).map(col => (
                              <button
                                key={col.id}
                                onClick={() => setVisibleColumns(prev => ({ ...prev, [col.id]: !prev[col.id] }))}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors group"
                              >
                                <span className={cn("text-xs font-medium", visibleColumns[col.id] ? "text-zinc-900" : "text-zinc-400")}>
                                  {col.label}
                                </span>
                                <div className={cn(
                                  "w-8 h-4 rounded-full transition-all relative",
                                  visibleColumns[col.id] ? "bg-blue-500" : "bg-zinc-200"
                                )}>
                                  <div className={cn(
                                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm",
                                    visibleColumns[col.id] ? "left-4.5" : "left-0.5"
                                  )} />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-2 bg-zinc-50 border-t border-zinc-100 flex justify-between">
                      <button 
                        onClick={() => {
                          const allTrue = Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {});
                          setVisibleColumns(allTrue);
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 px-2 py-1"
                      >
                        Hiện tất cả
                      </button>
                      <button 
                        onClick={() => setIsColumnMenuOpen(false)}
                        className="text-[10px] font-bold text-zinc-500 hover:text-zinc-700 px-2 py-1"
                      >
                        Đóng
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 overflow-x-hidden pb-8"
        >
          <div className="w-full space-y-10">
            {/* Section 1: Company & Bans */}
            {dashboardTab === 'revenue' && (
              <div id="section-bans" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-zinc-900 rounded-full" />
                    <h2 className="text-xl font-bold text-zinc-800">Khối Ban trực thuộc Công ty</h2>
                  </div>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-100 px-3 py-1 rounded-full">
                    {sortedOverview.bansSection.length - 1} Ban
                  </div>
                </div>
                <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-separate border-spacing-0 table-fixed">
                      <colgroup>
                        <col className="w-[25%]" />
                        {COLUMN_CONFIG.map(col => visibleColumns[col.id] && (
                          <col key={col.id} style={{ width: `${75 / COLUMN_CONFIG.filter(c => visibleColumns[c.id]).length}%` }} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr className="bg-zinc-200 text-[12px] font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-300">
                          <th rowSpan={2} className="px-1 py-3 border-r border-zinc-300">Bộ phận</th>
                          {getVisibleCount('Tháng') > 0 && (
                            <th colSpan={getVisibleCount('Tháng')} className="px-1 py-2 text-center border-r border-zinc-300 bg-blue-100/80">{months[selectedMonth]}</th>
                          )}
                          {getVisibleCount('Lũy kế') > 0 && (
                            <th colSpan={getVisibleCount('Lũy kế')} className="px-1 py-2 text-center border-r border-zinc-300 bg-amber-100/80">Lũy kế</th>
                          )}
                          {getVisibleCount('Năm') > 0 && (
                            <th colSpan={getVisibleCount('Năm')} className="px-1 py-2 text-center bg-zinc-200">Năm</th>
                          )}
                        </tr>
                        <tr className="bg-zinc-100 text-[11px] font-bold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                          {visibleColumns.monthActual && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Thực tế</th>}
                          {visibleColumns.monthPlan && <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH</th>}
                          {visibleColumns.monthPerfVsPlan && <th className="px-1 py-2 text-center border-r border-zinc-300/50">% KH</th>}
                          {visibleColumns.monthLastYear && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Cùng kỳ</th>}
                          {visibleColumns.monthPerfVsLastYear && <th className="px-1 py-2 border-r border-zinc-300 text-center">% CK</th>}
                          
                          {visibleColumns.actual && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Thực tế</th>}
                          {visibleColumns.plan && <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH</th>}
                          {visibleColumns.perfVsPlan && <th className="px-1 py-2 text-center border-r border-zinc-300/50">% KH</th>}
                          {visibleColumns.lastYear && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Cùng kỳ</th>}
                          {visibleColumns.perfVsLastYear && <th className="px-1 py-2 border-r border-zinc-300 text-center">% CK</th>}
                          
                          {visibleColumns.annualPlan && <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH Năm</th>}
                          {visibleColumns.annualCompletion && <th className="px-1 py-2 text-center">% HT</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {renderDepartmentRowSet(sortedOverview.company, { isHeaderTotal: true, showExpand: true })}
                        <AnimatePresence initial={false}>
                          {expandedDepts.has(sortedOverview.company.id) && sortedOverview.bansSection.filter((d: any) => d.type === 'ban').map((dept: any) => (
                            renderDepartmentRowSet(dept, { indent: 1 })
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                  
                  {dashboardTab !== 'product' && (
                    <DepartmentCharts 
                      dept={sortedOverview.company} 
                      subDepts={sortedOverview.bansSection.filter((d: any) => d.type === 'ban')} 
                      title="Khối Ban"
                    />
                  )}
                </div>
            )}

            {/* Section 2: Company & Centers */}
            {dashboardTab !== 'product' && (
              <div id="section-centers" className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                  <h2 className="text-xl font-bold text-zinc-800">Khối Trung tâm & Phòng trực thuộc</h2>
                </div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-100 px-3 py-1 rounded-full">
                  {sortedOverview.centersSection.length - 1} Trung tâm
                </div>
              </div>
              
              {/* Unified Scroll Container for Section 2 */}
              <div className="overflow-x-auto pb-4 -mx-4 px-4">
                <div className="min-w-[1200px] space-y-6">
                  {/* Company Header Row for Centers */}
                  <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-separate border-spacing-0 table-fixed">
                    <colgroup>
                      <col className="w-[25%]" />
                      {COLUMN_CONFIG.map(col => visibleColumns[col.id] && (
                        <col key={col.id} style={{ width: `${75 / COLUMN_CONFIG.filter(c => visibleColumns[c.id]).length}%` }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr className="bg-zinc-200 text-[12px] font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-300">
                        <th rowSpan={2} className="px-1 py-3 border-r border-zinc-300">Bộ phận</th>
                        {getVisibleCount('Tháng') > 0 && (
                          <th colSpan={getVisibleCount('Tháng')} className="px-1 py-2 text-center border-r border-zinc-300 bg-blue-100/80">{months[selectedMonth]}</th>
                        )}
                        {getVisibleCount('Lũy kế') > 0 && (
                          <th colSpan={getVisibleCount('Lũy kế')} className="px-1 py-2 text-center border-r border-zinc-300 bg-amber-100/80">Lũy kế</th>
                        )}
                        {getVisibleCount('Năm') > 0 && (
                          <th colSpan={getVisibleCount('Năm')} className="px-1 py-2 text-center bg-zinc-200">Năm</th>
                        )}
                      </tr>
                      <tr className="bg-zinc-100 text-[11px] font-bold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        {visibleColumns.monthActual && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Thực tế</th>}
                        {visibleColumns.monthPlan && <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH</th>}
                        {visibleColumns.monthPerfVsPlan && <th className="px-1 py-2 text-center border-r border-zinc-300/50">% KH</th>}
                        {visibleColumns.monthLastYear && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Cùng kỳ</th>}
                        {visibleColumns.monthPerfVsLastYear && <th className="px-1 py-2 border-r border-zinc-300 text-center">% CK</th>}
                        
                        {visibleColumns.actual && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Thực tế</th>}
                        {visibleColumns.plan && <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH</th>}
                        {visibleColumns.perfVsPlan && <th className="px-1 py-2 text-center border-r border-zinc-300/50">% KH</th>}
                        {visibleColumns.lastYear && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Cùng kỳ</th>}
                        {visibleColumns.perfVsLastYear && <th className="px-1 py-2 border-r border-zinc-300 text-center">% CK</th>}
                        
                        {visibleColumns.annualPlan && <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH Năm</th>}
                        {visibleColumns.annualCompletion && <th className="px-1 py-2 text-center">% HT</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {renderDepartmentRowSet(sortedOverview.centersTotal, { isHeaderTotal: true, showExpand: true })}
                    </tbody>
                  </table>
                </div>

                {dashboardTab === 'profit' && (
                  <div className="mb-6">
                    <DepartmentCharts 
                      dept={sortedOverview.centersTotal} 
                      subDepts={sortedOverview.centersSection.filter((d: any) => d.type === 'center')} 
                      title="Hợp nhất Lợi nhuận"
                    />
                  </div>
                )}

                  {/* Center Groups (Separate Boxes) */}
                  <AnimatePresence initial={false}>
                    {(dashboardTab === 'profit' || expandedDepts.has(sortedOverview.centersTotal.id)) && (
                      <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="grid grid-cols-1 gap-4"
                      >
                        {sortedOverview.centersSection.filter((d: any) => d.type === 'center').map((center: any) => (
                          <div id={`center-table-${center.id}`} key={center.id} className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <table className="w-full text-left border-separate border-spacing-0 table-fixed">
                        <colgroup>
                          <col className="w-[25%]" />
                          {COLUMN_CONFIG.map(col => visibleColumns[col.id] && (
                            <col key={col.id} style={{ width: `${75 / COLUMN_CONFIG.filter(c => visibleColumns[c.id]).length}%` }} />
                          ))}
                        </colgroup>
                        <thead>
                          <tr className="bg-zinc-200 text-[12px] font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-300">
                            <th rowSpan={2} className="px-1 py-3 border-r border-zinc-300">Bộ phận</th>
                            {getVisibleCount('Tháng') > 0 && (
                              <th colSpan={getVisibleCount('Tháng')} className="px-1 py-2 text-center border-r border-zinc-300 bg-blue-100/80">{months[selectedMonth]}</th>
                            )}
                            {getVisibleCount('Lũy kế') > 0 && (
                              <th colSpan={getVisibleCount('Lũy kế')} className="px-1 py-2 text-center border-r border-zinc-300 bg-amber-100/80">Lũy kế</th>
                            )}
                            {getVisibleCount('Năm') > 0 && (
                              <th colSpan={getVisibleCount('Năm')} className="px-1 py-2 text-center bg-zinc-200">Năm</th>
                            )}
                          </tr>
                          <tr className="bg-zinc-100 text-[11px] font-bold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                            {visibleColumns.monthActual && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Thực tế</th>}
                            {visibleColumns.monthPlan && <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH</th>}
                            {visibleColumns.monthPerfVsPlan && <th className="px-1 py-2 text-center border-r border-zinc-300/50">% KH</th>}
                            {visibleColumns.monthLastYear && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Cùng kỳ</th>}
                            {visibleColumns.monthPerfVsLastYear && <th className="px-1 py-2 border-r border-zinc-300 text-center">% CK</th>}
                            
                            {visibleColumns.actual && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Thực tế</th>}
                            {visibleColumns.plan && <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH</th>}
                            {visibleColumns.perfVsPlan && <th className="px-1 py-2 text-center border-r border-zinc-300/50">% KH</th>}
                            {visibleColumns.lastYear && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Cùng kỳ</th>}
                            {visibleColumns.perfVsLastYear && <th className="px-1 py-2 border-r border-zinc-300 text-center">% CK</th>}
                            
                            {visibleColumns.annualPlan && <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH Năm</th>}
                            {visibleColumns.annualCompletion && <th className="px-1 py-2 text-center">% HT</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                          {renderDepartmentRowSet(center, { indent: 1, showExpand: dashboardTab === 'revenue' })}
                          <AnimatePresence initial={false}>
                            {dashboardTab === 'revenue' && expandedDepts.has(center.id) && center.phongs?.map((phong: any) => (
                              renderDepartmentRowSet(phong, { indent: 2, isPhong: true })
                            ))}
                          </AnimatePresence>
                        </tbody>
                      </table>

                      {dashboardTab !== 'product' && (
                        <div className="px-6 pb-6">
                          <DepartmentCharts 
                            dept={center} 
                            subDepts={center.phongs} 
                            title={`Bộ phận ${center.name}`}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

                </div>
              </div>
            </div>
          )}

          {/* Section 3: TMC Products */}
            {dashboardTab === 'product' && (
              <div id="section-products" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                    <h2 className="text-xl font-bold text-zinc-800">
                      Doanh thu TMC theo sản phẩm
                    </h2>
                  </div>
                </div>
                <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-separate border-spacing-0 table-fixed">
                    <colgroup>
                      <col className="w-[25%]" />
                      {COLUMN_CONFIG.map(col => visibleColumns[col.id] && (
                        <col key={col.id} style={{ width: `${75 / COLUMN_CONFIG.filter(c => visibleColumns[c.id]).length}%` }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr className="bg-zinc-200 text-[12px] font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-300">
                        <th rowSpan={2} className="px-1 py-3 border-r border-zinc-300">Sản phẩm</th>
                        {getVisibleCount('Tháng') > 0 && (
                          <th colSpan={getVisibleCount('Tháng')} className="px-1 py-2 text-center border-r border-zinc-300 bg-blue-100/80">{months[selectedMonth]}</th>
                        )}
                        {getVisibleCount('Lũy kế') > 0 && (
                          <th colSpan={getVisibleCount('Lũy kế')} className="px-1 py-2 text-center border-r border-zinc-300 bg-amber-100/80">Lũy kế</th>
                        )}
                        {getVisibleCount('Năm') > 0 && (
                          <th colSpan={getVisibleCount('Năm')} className="px-1 py-2 text-center bg-zinc-200">Năm</th>
                        )}
                      </tr>
                      <tr className="bg-zinc-100 text-[11px] font-bold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        {visibleColumns.monthActual && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Thực tế</th>}
                        {visibleColumns.monthPlan && <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH</th>}
                        {visibleColumns.monthPerfVsPlan && <th className="px-1 py-2 text-center border-r border-zinc-300/50">% KH</th>}
                        {visibleColumns.monthLastYear && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Cùng kỳ</th>}
                        {visibleColumns.monthPerfVsLastYear && <th className="px-1 py-2 border-r border-zinc-300 text-center">% CK</th>}
                        
                        {visibleColumns.actual && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Thực tế</th>}
                        {visibleColumns.plan && <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH</th>}
                        {visibleColumns.perfVsPlan && <th className="px-1 py-2 text-center border-r border-zinc-300/50">% KH</th>}
                        {visibleColumns.lastYear && <th className="px-1 py-2 text-right border-r border-zinc-300/50">Cùng kỳ</th>}
                        {visibleColumns.perfVsLastYear && <th className="px-1 py-2 border-r border-zinc-300 text-center">% CK</th>}
                        
                        {visibleColumns.annualPlan && <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH Năm</th>}
                        {visibleColumns.annualCompletion && <th className="px-1 py-2 text-center">% HT</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {sortedOverview.productsSection.map((item: any) => (
                        <tr 
                          key={item.id} 
                          className={cn(
                            "group hover:bg-zinc-50/50 transition-colors cursor-pointer",
                            item.type === 'company' && "bg-zinc-50/30 font-bold"
                          )}
                          onClick={() => setSelectedDeptId(item.id)}
                        >
                          <td className="px-1.5 py-1.5 border-r border-zinc-50/50">
                            <div className={cn("flex items-center gap-2", item.indent === 1 ? "pl-4" : "pl-8")}>
                              <div className={cn("w-1 h-1 rounded-full", item.type === 'company' ? "bg-zinc-900" : "bg-blue-500")} />
                              <span className={cn("text-[13px] truncate", item.type === 'company' ? "text-zinc-900 font-bold" : "text-zinc-600 font-normal")}>
                                {item.name}
                              </span>
                            </div>
                          </td>
                          {visibleColumns.monthActual && <td className={cn("px-1 py-1.5 text-right", item.type === 'company' ? "text-[13px]" : "text-[12px]")}>{formatNumber(item.monthActual)}</td>}
                          {visibleColumns.monthPlan && <td className={cn("px-1 py-1.5 text-zinc-500 text-right", item.type === 'company' ? "text-[13px]" : "text-[12px]")}>{formatNumber(item.monthPlan)}</td>}
                          {visibleColumns.monthPerfVsPlan && (
                            <td className="px-1 py-1.5">
                              <div className="flex items-center gap-1">
                                <MiniProgress percentage={item.monthPerfVsPlan} />
                                <span className={cn("text-[11px] font-bold min-w-[28px] text-right", 
                                  getPerformanceTextColor(item.monthPerfVsPlan)
                                )}>
                                  {formatPercent(item.monthPerfVsPlan)}
                                </span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.monthLastYear && <td className={cn("px-1 py-1.5 text-zinc-500 text-right", item.type === 'company' ? "text-[13px]" : "text-[12px]")}>{formatNumber(item.monthLastYear)}</td>}
                          {visibleColumns.monthPerfVsLastYear && (
                            <td className="px-1 py-1.5 border-r border-zinc-50/50">
                              <div className="flex items-center gap-1">
                                <MiniProgress percentage={item.monthPerfVsLastYear} />
                                <span className={cn("text-[11px] font-bold min-w-[28px] text-right", 
                                  getPerformanceTextColor(item.monthPerfVsLastYear)
                                )}>
                                  {formatPercent(item.monthPerfVsLastYear)}
                                </span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.actual && <td className={cn("px-1 py-1.5 text-right", item.type === 'company' ? "text-[13px]" : "text-[12px]")}>{formatNumber(item.actual)}</td>}
                          {visibleColumns.plan && <td className={cn("px-1 py-1.5 text-zinc-500 text-right", item.type === 'company' ? "text-[13px]" : "text-[12px]")}>{formatNumber(item.plan)}</td>}
                          {visibleColumns.perfVsPlan && (
                            <td className="px-1 py-1.5">
                              <div className="flex items-center gap-1">
                                <MiniProgress percentage={item.perfVsPlan} />
                                <span className={cn("text-[11px] font-bold min-w-[28px] text-right", 
                                  getPerformanceTextColor(item.perfVsPlan)
                                )}>
                                  {formatPercent(item.perfVsPlan)}
                                </span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.lastYear && <td className={cn("px-1 py-1.5 text-zinc-500 text-right", item.type === 'company' ? "text-[13px]" : "text-[12px]")}>{formatNumber(item.lastYear)}</td>}
                          {visibleColumns.perfVsLastYear && (
                            <td className="px-1 py-1.5 border-r border-zinc-50/50">
                              <div className="flex items-center gap-1">
                                <MiniProgress percentage={item.perfVsLastYear} />
                                <span className={cn("text-[11px] font-bold min-w-[28px] text-right", 
                                  getPerformanceTextColor(item.perfVsLastYear)
                                )}>
                                  {formatPercent(item.perfVsLastYear)}
                                </span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.annualPlan && <td className={cn("px-1 py-1.5 text-zinc-500 text-right", item.type === 'company' ? "text-[13px]" : "text-[12px]")}>{formatNumber(item.annualPlan)}</td>}
                          {visibleColumns.annualCompletion && (
                            <td className="px-1 py-1.5">
                              <div className="flex items-center gap-1">
                                <MiniProgress percentage={item.annualCompletion} />
                                <span className={cn("text-[11px] font-bold min-w-[28px] text-right", 
                                  getPerformanceTextColor(item.annualCompletion)
                                )}>
                                  {formatPercent(item.annualCompletion)}
                                </span>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Product Charts */}
                <div className="mt-6">
                  <button 
                    onClick={() => toggleChart('tmc_products')}
                    className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 transition-colors uppercase tracking-widest mb-4"
                  >
                    {visibleCharts.has('tmc_products') ? <Minus size={14} /> : <Plus size={14} />}
                    {visibleCharts.has('tmc_products') ? 'Ẩn biểu đồ' : 'Xem biểu đồ'} Doanh thu Sản phẩm
                  </button>

                  <AnimatePresence>
                    {visibleCharts.has('tmc_products') && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Monthly Proportion Chart */}
                          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-6">
                              <div className="w-1 h-4 bg-blue-500 rounded-full" />
                              <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">
                                Tỷ trọng doanh thu thực tế tháng {months[selectedMonth]}
                              </h3>
                            </div>
                            <div className="h-[400px] w-full">
                              {productChartData.month.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={productChartData.month}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={80}
                                      outerRadius={120}
                                      paddingAngle={4}
                                      dataKey="value"
                                      animationBegin={0}
                                      animationDuration={1500}
                                      labelLine={false}
                                      label={renderCustomizedLabel}
                                    >
                                      {productChartData.month.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
                                      ))}
                                    </Pie>
                                    <Tooltip 
                                      formatter={(value: number) => [formatNumber(value), 'Doanh thu']}
                                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend 
                                      verticalAlign="bottom" 
                                      height={36}
                                      iconType="circle"
                                      formatter={(value) => <span className="text-[10px] font-medium text-zinc-600">{value}</span>}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="h-full flex items-center justify-center text-zinc-400 text-sm italic">
                                  Không có dữ liệu thực tế trong tháng
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Cumulative Proportion Chart */}
                          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-6">
                              <div className="w-1 h-4 bg-amber-500 rounded-full" />
                              <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">
                                Tỷ trọng doanh thu thực tế lũy kế
                              </h3>
                            </div>
                            <div className="h-[400px] w-full">
                              {productChartData.cumulative.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={productChartData.cumulative}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={80}
                                      outerRadius={120}
                                      paddingAngle={4}
                                      dataKey="value"
                                      animationBegin={0}
                                      animationDuration={1500}
                                      labelLine={false}
                                      label={renderCustomizedLabel}
                                    >
                                      {productChartData.cumulative.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
                                      ))}
                                    </Pie>
                                    <Tooltip 
                                      formatter={(value: number) => [formatNumber(value), 'Doanh thu']}
                                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend 
                                      verticalAlign="bottom" 
                                      height={36}
                                      iconType="circle"
                                      formatter={(value) => <span className="text-[10px] font-medium text-zinc-600">{value}</span>}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="h-full flex items-center justify-center text-zinc-400 text-sm italic">
                                  Không có dữ liệu thực tế lũy kế
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </main>

      {/* Google Sheets Integration Modal */}
      <AnimatePresence>
        {isGSheetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 pb-4 flex items-center justify-between shrink-0 border-b border-zinc-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
                    <Cloud size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900">Google Sheets</h2>
                    <p className="text-sm text-zinc-500 font-medium">Kết nối và đồng bộ dữ liệu trực tuyến</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsGSheetModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 pt-6 overflow-y-auto space-y-6">
                <div className="space-y-6">
                  <div className="space-y-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-blue-500 rounded-full" />
                      <h4 className="text-sm font-bold text-zinc-700">Cấu hình Doanh thu</h4>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Google Sheet ID (Doanh thu)</label>
                      <input 
                        type="text" 
                        placeholder="Nhập ID Sheet Doanh thu..."
                        value={gsheetConfig?.sheetId || ''}
                        onChange={(e) => {
                          const newConfig = { ...(gsheetConfig || { autoSync: false, profitSheetId: '' }), sheetId: e.target.value };
                          setGsheetConfig(newConfig);
                          dataService.saveGoogleSheetConfig(newConfig);
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                      {gsheetConfig?.lastSync && (
                        <p className="text-[10px] text-zinc-400">Đồng bộ cuối: {new Date(gsheetConfig.lastSync).toLocaleString()}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                      <h4 className="text-sm font-bold text-zinc-700">Cấu hình Lợi nhuận</h4>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Google Sheet ID (Lợi nhuận)</label>
                      <input 
                        type="text" 
                        placeholder="Nhập ID Sheet Lợi nhuận..."
                        value={gsheetConfig?.profitSheetId || ''}
                        onChange={(e) => {
                          const newConfig = { ...(gsheetConfig || { autoSync: false, sheetId: '' }), profitSheetId: e.target.value };
                          setGsheetConfig(newConfig);
                          dataService.saveGoogleSheetConfig(newConfig);
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                      {gsheetConfig?.lastProfitSync && (
                        <p className="text-[10px] text-zinc-400">Đồng bộ cuối: {new Date(gsheetConfig.lastProfitSync).toLocaleString()}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-blue-500 rounded-full" />
                      <h4 className="text-sm font-bold text-zinc-700">Cấu hình Sản phẩm TMC</h4>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Google Sheet ID (Sản phẩm)</label>
                      <input 
                        type="text" 
                        placeholder="Nhập ID Sheet Sản phẩm..."
                        value={gsheetConfig?.productSheetId || ''}
                        onChange={(e) => {
                          const newConfig = { ...(gsheetConfig || { autoSync: false, sheetId: '' }), productSheetId: e.target.value };
                          setGsheetConfig(newConfig);
                          dataService.saveGoogleSheetConfig(newConfig);
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                      {gsheetConfig?.lastProductSync && (
                        <p className="text-[10px] text-zinc-400">Đồng bộ cuối: {new Date(gsheetConfig.lastProductSync).toLocaleString()}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-zinc-700">Tự động đồng bộ</h4>
                      <p className="text-xs text-zinc-400">Tự động cập nhật khi mở ứng dụng</p>
                    </div>
                    <button 
                      onClick={() => {
                        const newConfig = { ...(gsheetConfig || { sheetId: '', profitSheetId: '', productSheetId: '', autoSync: false }), autoSync: !gsheetConfig?.autoSync };
                        setGsheetConfig(newConfig);
                        dataService.saveGoogleSheetConfig(newConfig);
                      }}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        gsheetConfig?.autoSync ? "bg-zinc-900" : "bg-zinc-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        gsheetConfig?.autoSync ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={downloadGSheetTemplate}
                      className="flex items-center justify-center gap-2 py-3 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-all"
                    >
                      <Download size={18} />
                      <span>Tải template</span>
                    </button>
                    <button 
                      onClick={handleSyncGSheet}
                      disabled={!(dashboardTab === 'revenue' ? gsheetConfig?.sheetId : dashboardTab === 'profit' ? gsheetConfig?.profitSheetId : gsheetConfig?.productSheetId) || isSyncing}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all shadow-lg",
                        isSyncing ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-100"
                      )}
                    >
                      <RefreshCw size={18} className={cn(isSyncing && "animate-spin")} />
                      {isSyncing ? 'Đang đồng bộ...' : `Đồng bộ ${dashboardTab === 'revenue' ? 'Doanh thu' : dashboardTab === 'profit' ? 'Lợi nhuận' : 'Sản phẩm'}`}
                    </button>
                  </div>

                  {syncStatus && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-4 rounded-2xl text-xs font-bold flex items-center gap-3",
                        syncStatus.type === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        syncStatus.type === 'success' ? "bg-emerald-500" : "bg-rose-500"
                      )} />
                      <p className="flex-1 whitespace-pre-line">{syncStatus.message}</p>
                      <button onClick={() => setSyncStatus(null)} className="p-1 hover:bg-black/5 rounded-full">
                        <X size={14} />
                      </button>
                    </motion.div>
                  )}

                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-3">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Info size={16} />
                      <h4 className="font-bold text-xs uppercase tracking-wider">Hướng dẫn chia sẻ</h4>
                    </div>
                    <ol className="text-[11px] text-blue-700 space-y-1.5 list-decimal pl-4 leading-relaxed">
                      <li>Mở Google Sheet của bạn.</li>
                      <li>Nhấn nút <strong>Chia sẻ (Share)</strong> ở góc trên bên phải.</li>
                      <li>Ở mục "Quyền truy cập chung", chọn <strong>Bất kỳ ai có liên kết (Anyone with the link)</strong>.</li>
                      <li>Đảm bảo quyền là <strong>Người xem (Viewer)</strong>.</li>
                      <li>Copy toàn bộ URL trình duyệt và dán vào ô cấu hình tương ứng.</li>
                    </ol>
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button 
                        onClick={() => {
                          const id = gsheetConfig?.sheetId;
                          if (id) {
                            const cleanId = id.includes('/d/') ? id.split('/d/')[1].split('/')[0] : id;
                            window.open(`https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv`, '_blank');
                          } else {
                            alert('Vui lòng nhập ID Sheet Doanh thu trước.');
                          }
                        }}
                        className="px-3 py-2 bg-white border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-600 hover:bg-emerald-100 transition-all"
                      >
                        Link Doanh thu
                      </button>
                      <button 
                        onClick={() => {
                          const id = gsheetConfig?.profitSheetId;
                          if (id) {
                            const cleanId = id.includes('/d/') ? id.split('/d/')[1].split('/')[0] : id;
                            window.open(`https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv`, '_blank');
                          } else {
                            alert('Vui lòng nhập ID Sheet Lợi nhuận trước.');
                          }
                        }}
                        className="px-3 py-2 bg-white border border-amber-200 rounded-lg text-[10px] font-bold text-amber-600 hover:bg-amber-100 transition-all"
                      >
                        Link Lợi nhuận
                      </button>
                      <button 
                        onClick={() => {
                          const id = gsheetConfig?.productSheetId;
                          if (id) {
                            const cleanId = id.includes('/d/') ? id.split('/d/')[1].split('/')[0] : id;
                            window.open(`https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv`, '_blank');
                          } else {
                            alert('Vui lòng nhập ID Sheet Sản phẩm trước.');
                          }
                        }}
                        className="px-3 py-2 bg-white border border-blue-200 rounded-lg text-[10px] font-bold text-blue-600 hover:bg-blue-100 transition-all"
                      >
                        Link Sản phẩm
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="px-8 py-6 bg-zinc-50 flex justify-end">
                <button 
                  onClick={() => setIsGSheetModalOpen(false)}
                  className="px-8 py-3 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">Xuất ảnh báo cáo</h3>
                    <p className="text-xs text-zinc-500 font-medium">Chọn các bảng dữ liệu để đưa vào ảnh (Size 16:9)</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
                >
                  <X size={20} className="text-zinc-400" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {dashboardTab === 'revenue' && (
                    <button 
                      onClick={() => {
                        setSelectedExportIds(prev => 
                          prev.includes('section-bans') 
                            ? prev.filter(id => id !== 'section-bans')
                            : [...prev, 'section-bans']
                        );
                      }}
                      className={cn(
                        "p-4 rounded-2xl border-2 text-left transition-all group",
                        selectedExportIds.includes('section-bans')
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-100 bg-zinc-50 text-zinc-600 hover:border-zinc-300"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <TableIcon size={20} className={selectedExportIds.includes('section-bans') ? "text-white/60" : "text-zinc-400"} />
                        {selectedExportIds.includes('section-bans') && <Check size={16} />}
                      </div>
                      <span className="text-sm font-bold">Bảng Khối Ban</span>
                    </button>
                  )}
                  
                  <button 
                    onClick={() => {
                      setSelectedExportIds(prev => 
                        prev.includes('section-centers') 
                          ? prev.filter(id => id !== 'section-centers')
                          : [...prev, 'section-centers']
                      );
                    }}
                    className={cn(
                      "p-4 rounded-2xl border-2 text-left transition-all group",
                      selectedExportIds.includes('section-centers')
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-100 bg-zinc-50 text-zinc-600 hover:border-zinc-300"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <TableIcon size={20} className={selectedExportIds.includes('section-centers') ? "text-white/60" : "text-zinc-400"} />
                      {selectedExportIds.includes('section-centers') && <Check size={16} />}
                    </div>
                    <span className="text-sm font-bold">{dashboardTab === 'profit' ? 'Bảng Hợp nhất Công ty' : 'Bảng Tổng Trung tâm'}</span>
                  </button>

                  {sortedOverview.centersSection.filter((d: any) => d.type === 'center').map((center: any) => (
                    <button 
                      key={center.id}
                      onClick={() => {
                        const id = `center-table-${center.id}`;
                        setSelectedExportIds(prev => 
                          prev.includes(id) 
                            ? prev.filter(i => i !== id)
                            : [...prev, id]
                        );
                      }}
                      className={cn(
                        "p-4 rounded-2xl border-2 text-left transition-all group",
                        selectedExportIds.includes(`center-table-${center.id}`)
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-100 bg-zinc-50 text-zinc-600 hover:border-zinc-300"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <TableIcon size={20} className={selectedExportIds.includes(`center-table-${center.id}`) ? "text-white/60" : "text-zinc-400"} />
                        {selectedExportIds.includes(`center-table-${center.id}`) && <Check size={16} />}
                      </div>
                      <span className="text-sm font-bold">Bảng {center.name}</span>
                    </button>
                  ))}
                </div>

                <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
                  <div className="flex items-start gap-3">
                    <Info size={18} className="text-zinc-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-zinc-700">Lưu ý khi xuất ảnh:</p>
                      <ul className="text-[11px] text-zinc-500 space-y-1 list-disc pl-4">
                        <li>Ảnh sẽ được xuất với độ phân giải cao (1920x1080).</li>
                        <li>Nếu chọn nhiều bảng, chúng sẽ được sắp xếp tự động để tối ưu không gian.</li>
                        <li>Đảm bảo các bảng dữ liệu đang hiển thị đầy đủ trên màn hình trước khi xuất.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                <div className="text-xs text-zinc-500 font-bold">
                  Đã chọn: <span className="text-zinc-900">{selectedExportIds.length}</span> bảng
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedExportIds([])}
                    className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    Xóa chọn
                  </button>
                  <button 
                    onClick={handleExportImage}
                    disabled={selectedExportIds.length === 0 || isExporting}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold text-white transition-all shadow-lg",
                      selectedExportIds.length === 0 || isExporting
                        ? "bg-zinc-300 shadow-none"
                        : "bg-zinc-900 hover:bg-zinc-800 active:scale-95"
                    )}
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Đang xử lý...</span>
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        <span>Tải ảnh PNG</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isYearManagementOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
                      <Settings size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-zinc-900">Quản lý Năm</h2>
                      <p className="text-sm text-zinc-500 font-medium">Khai báo năm và quản lý dữ liệu hệ thống</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsYearManagementOpen(false)}
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400"
                  >
                    <ChevronDown size={24} className="rotate-90" />
                  </button>
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">Danh sách năm đã khai báo</label>
                    <div className="grid grid-cols-3 gap-3">
                      {availableYears.map(year => (
                        <div 
                          key={year}
                          className={cn(
                            "relative px-4 py-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all group",
                            selectedYear === year 
                              ? "bg-zinc-900 border-zinc-900 text-white shadow-lg" 
                              : "bg-white border-zinc-100 text-zinc-600"
                          )}
                        >
                          <span className="text-lg font-bold">{year}</span>
                          {year === currentYear && (
                            <span className={cn(
                              "text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter",
                              selectedYear === year ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                            )}>
                              Hiện tại
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteYear(year);
                            }}
                            className="absolute -top-2 -right-2 p-1.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            title="Xóa năm"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => handleAddYear()}
                        className="px-4 py-3 rounded-2xl border-2 border-dashed border-zinc-200 text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-all flex flex-col items-center justify-center gap-1"
                      >
                        <TableIcon size={20} />
                        <span className="text-[10px] font-bold uppercase">Thêm năm</span>
                      </button>
                    </div>
                </div>

                <div className="pt-6 border-t border-zinc-100 space-y-4">
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 space-y-3">
                      <div className="flex items-center gap-3 text-rose-600">
                        <Info size={18} />
                        <h4 className="font-bold text-sm">Vùng nguy hiểm</h4>
                      </div>
                      <p className="text-xs text-rose-500 leading-relaxed font-medium">
                        Các hành động dưới đây sẽ xóa dữ liệu vĩnh viễn và không thể khôi phục.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button 
                          onClick={handleResetCurrentYear}
                          className="py-3 bg-white border border-rose-200 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-50 transition-all"
                        >
                          Reset năm {selectedYear}
                        </button>
                        <button 
                          onClick={handleClearAllData}
                          className="py-3 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                        >
                          Xóa tất cả các năm
                        </button>
                      </div>
                    </div>
                </div>
              </div>
              
              <div className="px-8 py-6 bg-zinc-50 flex justify-end">
                <button 
                  onClick={() => setIsYearManagementOpen(false)}
                  className="px-8 py-3 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                >
                  Hoàn tất
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dept Selector Modal */}
      <AnimatePresence>
        {isDeptMenuOpen && (
          <>
            <div className="fixed inset-0 z-50 bg-zinc-900/20 backdrop-blur-sm" onClick={() => setIsDeptMenuOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-md bg-white rounded-3xl shadow-2xl border border-zinc-100 p-6"
            >
              <h3 className="text-lg font-bold mb-4">Chọn bộ phận xem chi tiết</h3>
              <div className="grid grid-cols-1 gap-2">
                {cumulativeOverview.filter(d => d.type === 'company').map(company => (
                  <div key={company.id} className="space-y-1">
                    <button
                      onClick={() => {
                        setSelectedDeptId(company.id);
                        setIsDeptMenuOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all",
                        selectedDeptId === company.id 
                          ? "bg-zinc-900 text-white shadow-lg" 
                          : "text-zinc-600 hover:bg-zinc-100"
                      )}
                    >
                      {company.name}
                    </button>
                    
                    {/* Bans */}
                    {cumulativeOverview.filter(d => d.type === 'ban').map(ban => (
                      <button
                        key={ban.id}
                        onClick={() => {
                          setSelectedDeptId(ban.id);
                          setIsDeptMenuOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ml-4 w-[calc(100%-1rem)]",
                          selectedDeptId === ban.id 
                            ? "bg-amber-500 text-white shadow-lg" 
                            : "text-zinc-600 hover:bg-zinc-100"
                        )}
                      >
                        {ban.name}
                      </button>
                    ))}

                    {/* Centers */}
                    {cumulativeOverview.filter(d => d.type === 'center').map(center => (
                      <div key={center.id} className="space-y-1">
                        <button
                          onClick={() => {
                            setSelectedDeptId(center.id);
                            setIsDeptMenuOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ml-4 w-[calc(100%-1rem)]",
                            selectedDeptId === center.id 
                              ? "bg-blue-500 text-white shadow-lg" 
                              : "text-zinc-600 hover:bg-zinc-100"
                          )}
                        >
                          {center.name}
                        </button>
                        
                        {/* Phongs */}
                        {cumulativeOverview.filter(d => d.parentId === center.id).map(phong => (
                          <button
                            key={phong.id}
                            onClick={() => {
                              setSelectedDeptId(phong.id);
                              setIsDeptMenuOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ml-8 w-[calc(100%-2rem)]",
                              selectedDeptId === phong.id 
                                ? "bg-zinc-400 text-white shadow-lg" 
                                : "text-zinc-500 hover:bg-zinc-100"
                            )}
                          >
                            {phong.name}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Data Entry Modal */}
      <AnimatePresence>
        {isDataEntryOpen && (
          <DataEntry 
            data={allDepts} 
            year={selectedYear}
            initialTab={dashboardTab}
            gsheetConfig={gsheetConfig}
            onSave={handleSaveData} 
            onClose={() => setIsDataEntryOpen(false)} 
          />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-zinc-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-400 text-sm">
          <p>© 2026 Corporate Analytics System. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-zinc-600 transition-colors">Báo cáo chi tiết</a>
            <a href="#" className="hover:text-zinc-600 transition-colors">Cài đặt hệ thống</a>
            <a href="#" className="hover:text-zinc-600 transition-colors">Trợ giúp</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
