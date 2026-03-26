import React, { useState, useMemo, useEffect } from 'react';
import { LayoutDashboard, Building2, ChevronDown, Filter, Info, Settings, Table as TableIcon, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dataService } from './services/dataService';
import { StatCard } from './components/StatCard';
import { PerformanceChart } from './components/PerformanceChart';
import { DataEntry } from './components/DataEntry';
import { MiniProgress } from './components/MiniProgress';
import { DepartmentData } from './types';
import { cn, formatNumber, formatPercent, getPerformanceBadgeColor } from './utils';

export default function App() {
  const [allDepts, setAllDepts] = useState<DepartmentData[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [isDeptMenuOpen, setIsDeptMenuOpen] = useState(false);
  const [isMonthMenuOpen, setIsMonthMenuOpen] = useState(false);
  const [isDataEntryOpen, setIsDataEntryOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'detail' | 'overview'>('overview');

  const months = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

  useEffect(() => {
    const data = dataService.getData();
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
  }, []);

  const selectedDept = useMemo(() => 
    allDepts.find(d => d.id === selectedDeptId) || allDepts[0],
    [selectedDeptId, allDepts]
  );

  const stats = useMemo(() => {
    if (!selectedDept) return { totalActual: 0, totalPlan: 0, totalLastYear: 0 };
    const monthly = selectedDept.monthly;
    // Calculate totals up to selected month
    const totalActual = monthly.slice(0, selectedMonth + 1).reduce((sum, m) => sum + m.actual, 0);
    const totalPlan = monthly.slice(0, selectedMonth + 1).reduce((sum, m) => sum + m.plan, 0);
    const totalLastYear = monthly.slice(0, selectedMonth + 1).reduce((sum, m) => sum + m.lastYear, 0);

    return {
      totalActual,
      totalPlan,
      totalLastYear,
    };
  }, [selectedDept, selectedMonth]);

  const cumulativeOverview = useMemo(() => {
    return allDepts.map(dept => {
      const cum = dataService.calculateCumulative(dept.monthly, selectedMonth);
      
      const currentMonth = dept.monthly[selectedMonth];

      return {
        ...dept,
        // Monthly
        monthActual: currentMonth.actual,
        monthPlan: currentMonth.plan,
        monthLastYear: currentMonth.lastYear,
        monthPerfVsPlan: currentMonth.plan > 0 ? (currentMonth.actual / currentMonth.plan) * 100 : null,
        monthPerfVsLastYear: currentMonth.lastYear > 0 ? (currentMonth.actual / currentMonth.lastYear) * 100 : null,
        // Cumulative
        actual: cum.actual,
        plan: cum.plan,
        lastYear: cum.lastYear,
        annualPlan: cum.annualPlan,
        perfVsPlan: cum.plan > 0 ? (cum.actual / cum.plan) * 100 : null,
        perfVsLastYear: cum.lastYear > 0 ? (cum.actual / cum.lastYear) * 100 : null,
        annualCompletion: cum.annualPlan > 0 ? (cum.actual / cum.annualPlan) * 100 : null,
      };
    });
  }, [allDepts, selectedMonth]);

  const sortedOverview = useMemo(() => {
    const company = cumulativeOverview.find(d => d.type === 'company');
    if (!company) return { bansSection: [], centersSection: [] };

    const bans = cumulativeOverview.filter(d => d.type === 'ban').map(b => ({ ...b, indent: 1 }));
    const centers = cumulativeOverview.filter(d => d.type === 'center').map(c => ({
      ...c,
      indent: 1,
      phongs: cumulativeOverview.filter(p => p.parentId === c.id).map(p => ({ ...p, indent: 2 }))
    }));

    return {
      company,
      bansSection: [company, ...bans],
      centersSection: [company, ...centers]
    };
  }, [cumulativeOverview]);

  const handleSaveData = (newData: DepartmentData[]) => {
    const aggregatedData = dataService.saveData(newData);
    setAllDepts(aggregatedData);
    setIsDataEntryOpen(false);
  };

  if (allDepts.length === 0) return null;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-200">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-lg">
              <LayoutDashboard size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard Hiệu Suất</h1>
              <p className="text-sm text-zinc-500 font-medium uppercase tracking-wider">Corporate Performance Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Month Selector */}
            <div className="relative">
              <button 
                onClick={() => setIsMonthMenuOpen(!isMonthMenuOpen)}
                className="flex items-center gap-3 px-5 py-2.5 bg-white border border-zinc-200 rounded-xl text-base font-bold text-zinc-700 hover:border-zinc-400 transition-all shadow-sm"
              >
                <Filter size={18} className="text-zinc-400" />
                <span>{months[selectedMonth]}</span>
                <ChevronDown size={18} className={cn("text-zinc-400 transition-transform", isMonthMenuOpen && "rotate-180")} />
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
                            "w-full px-4 py-2.5 text-left text-sm font-bold transition-colors hover:bg-zinc-50",
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

            <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
              <button 
                onClick={() => setViewMode('overview')}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                  viewMode === 'overview' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <TableIcon size={16} />
                Tổng quan
              </button>
              <button 
                onClick={() => setViewMode('detail')}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                  viewMode === 'detail' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <BarChart3 size={16} />
                Chi tiết
              </button>
            </div>

            <button 
              onClick={() => setIsDataEntryOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-base font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
            >
              <Settings size={18} />
              <span>Khai báo số liệu</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6 space-y-6">
        {/* Legend / Info */}
        <div className="flex flex-wrap items-center gap-6 p-4 bg-white border border-zinc-200 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-500 uppercase tracking-widest">
            <Info size={16} />
            <span>Chỉ số màu sắc:</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-base font-medium">≥ 100% (Đạt)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-base font-medium">80% - 99% (Cảnh báo)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="text-base font-medium">&lt; 80% (Kém)</span>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {viewMode === 'overview' ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10 overflow-x-hidden pb-8"
          >
            <div className="w-full space-y-10">
              {/* Section 1: Company & Bans */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                    <h2 className="text-xl font-bold text-zinc-800">Khối Ban trực thuộc Công ty</h2>
                  </div>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-100 px-3 py-1 rounded-full">
                    {sortedOverview.bansSection.length - 1} Ban
                  </div>
                </div>
                <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-separate border-spacing-0 table-fixed">
                    <colgroup>
                      <col className="w-[20%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[7%]" />
                      <col className="w-[6%]" />
                      <col className="w-[7%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[7%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[7%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-zinc-200 text-[11px] font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-300">
                        <th rowSpan={2} className="px-1 py-3 border-r border-zinc-300">Bộ phận</th>
                        <th colSpan={5} className="px-1 py-2 text-center border-r border-zinc-300 bg-blue-100/80">{months[selectedMonth]}</th>
                        <th colSpan={5} className="px-1 py-2 text-center border-r border-zinc-300 bg-amber-100/80">Lũy kế</th>
                        <th colSpan={2} className="px-1 py-2 text-center bg-zinc-200">Năm</th>
                      </tr>
                      <tr className="bg-zinc-100 text-[10px] font-bold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">Thực tế</th>
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH</th>
                        <th className="px-1 py-2 text-center border-r border-zinc-300/50">% KH</th>
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">Cùng kỳ</th>
                        <th className="px-1 py-2 border-r border-zinc-300 text-center">% CK</th>
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">Thực tế</th>
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH</th>
                        <th className="px-1 py-2 text-center border-r border-zinc-300/50">% KH</th>
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">Cùng kỳ</th>
                        <th className="px-1 py-2 border-r border-zinc-300 text-center">% CK</th>
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH Năm</th>
                        <th className="px-1 py-2 text-center">% HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {sortedOverview.bansSection.map((dept: any) => (
                        <tr key={dept.id} className={cn(
                          "group hover:bg-zinc-50/50 transition-colors cursor-pointer",
                          dept.type === 'company' && "bg-zinc-50/30"
                        )} onClick={() => {
                          setSelectedDeptId(dept.id);
                          setViewMode('detail');
                        }}>
                          <td className="px-1.5 py-1.5 border-r border-zinc-50/50">
                            <div className={cn(
                              "flex items-center gap-2",
                              dept.type === 'company' ? "pl-0" : "pl-4"
                            )}>
                              <div className={cn(
                                "w-1 h-1 rounded-full",
                                dept.type === 'company' ? "bg-zinc-900" : "bg-amber-500"
                              )} />
                              <span className={cn(
                                "text-[11px] text-zinc-900 truncate",
                                dept.type === 'company' ? "font-bold" : "font-normal"
                              )}>{dept.name}</span>
                            </div>
                          </td>
                          {/* Tháng hiện tại */}
                          <td className={cn("px-1 py-1.5 text-[11px] text-right", dept.type === 'company' ? "font-bold" : "font-normal")}>{formatNumber(dept.monthActual)}</td>
                          <td className={cn("px-1 py-1.5 text-[11px] text-zinc-500 text-right", dept.type === 'company' ? "font-bold" : "font-normal")}>{formatNumber(dept.monthPlan)}</td>
                          <td className="px-1 py-1.5">
                            <div className="flex items-center gap-1">
                              <MiniProgress percentage={dept.monthPerfVsPlan} />
                              <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                dept.monthPerfVsPlan >= 100 ? "text-emerald-600" : dept.monthPerfVsPlan >= 80 ? "text-amber-600" : "text-rose-600"
                              )}>
                                {formatPercent(dept.monthPerfVsPlan)}
                              </span>
                            </div>
                          </td>
                          <td className={cn("px-1 py-1.5 text-[11px] text-zinc-500 text-right", dept.type === 'company' ? "font-bold" : "font-normal")}>{formatNumber(dept.monthLastYear)}</td>
                          <td className="px-1 py-1.5 border-r border-zinc-50/50">
                            <div className="flex items-center gap-1">
                              <MiniProgress percentage={dept.monthPerfVsLastYear} />
                              <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                dept.monthPerfVsLastYear >= 100 ? "text-emerald-600" : dept.monthPerfVsLastYear >= 80 ? "text-amber-600" : "text-rose-600"
                              )}>
                                {formatPercent(dept.monthPerfVsLastYear)}
                              </span>
                            </div>
                          </td>
                          {/* Lũy kế */}
                          <td className={cn("px-1 py-1.5 text-[11px] text-right", dept.type === 'company' ? "font-bold" : "font-normal")}>{formatNumber(dept.actual)}</td>
                          <td className={cn("px-1 py-1.5 text-[11px] text-zinc-500 text-right", dept.type === 'company' ? "font-bold" : "font-normal")}>{formatNumber(dept.plan)}</td>
                          <td className="px-1 py-1.5">
                            <div className="flex items-center gap-1">
                              <MiniProgress percentage={dept.perfVsPlan} />
                              <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                dept.perfVsPlan >= 100 ? "text-emerald-600" : dept.perfVsPlan >= 80 ? "text-amber-600" : "text-rose-600"
                              )}>
                                {formatPercent(dept.perfVsPlan)}
                              </span>
                            </div>
                          </td>
                          <td className={cn("px-1 py-1.5 text-[11px] text-zinc-500 text-right", dept.type === 'company' ? "font-bold" : "font-normal")}>{formatNumber(dept.lastYear)}</td>
                          <td className="px-1 py-1.5 border-r border-zinc-50/50">
                            <div className="flex items-center gap-1">
                              <MiniProgress percentage={dept.perfVsLastYear} />
                              <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                dept.perfVsLastYear >= 100 ? "text-emerald-600" : dept.perfVsLastYear >= 80 ? "text-amber-600" : "text-rose-600"
                              )}>
                                {formatPercent(dept.perfVsLastYear)}
                              </span>
                            </div>
                          </td>
                          {/* Năm */}
                          <td className={cn("px-1 py-1.5 text-[11px] text-zinc-500 text-right", dept.type === 'company' ? "font-bold" : "font-normal")}>{formatNumber(dept.annualPlan)}</td>
                          <td className="px-1 py-1.5">
                            <div className="flex items-center gap-1">
                              <MiniProgress percentage={dept.annualCompletion} />
                              <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                dept.annualCompletion >= 100 ? "text-emerald-600" : dept.annualCompletion >= 80 ? "text-amber-600" : "text-rose-600"
                              )}>
                                {formatPercent(dept.annualCompletion)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Section 2: Company & Centers */}
            <div className="space-y-6">
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
                      <col className="w-[20%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[7%]" />
                      <col className="w-[6%]" />
                      <col className="w-[7%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[7%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[7%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-zinc-200 text-[11px] font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-300">
                        <th rowSpan={2} className="px-1 py-3 border-r border-zinc-300">Bộ phận</th>
                        <th colSpan={5} className="px-1 py-2 text-center border-r border-zinc-300 bg-blue-100/80">{months[selectedMonth]}</th>
                        <th colSpan={5} className="px-1 py-2 text-center border-r border-zinc-300 bg-amber-100/80">Lũy kế</th>
                        <th colSpan={2} className="px-1 py-2 text-center bg-zinc-200">Năm</th>
                      </tr>
                      <tr className="bg-zinc-100 text-[10px] font-bold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">Thực tế</th>
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH</th>
                        <th className="px-1 py-2 text-center border-r border-zinc-300/50">% KH</th>
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">Cùng kỳ</th>
                        <th className="px-1 py-2 border-r border-zinc-300 text-center">% CK</th>
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">Thực tế</th>
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH</th>
                        <th className="px-1 py-2 text-center border-r border-zinc-300/50">% KH</th>
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">Cùng kỳ</th>
                        <th className="px-1 py-2 border-r border-zinc-300 text-center">% CK</th>
                        <th className="px-1 py-2 text-right border-r border-zinc-300/50">KH Năm</th>
                        <th className="px-1 py-2 text-center">% HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-zinc-50/30 font-bold group hover:bg-zinc-50/50 transition-colors cursor-pointer" onClick={() => {
                        setSelectedDeptId(sortedOverview.company.id);
                        setViewMode('detail');
                      }}>
                        <td className="px-1.5 py-1.5 border-r border-zinc-50/50">
                          <div className="flex items-center gap-2 pl-0">
                            <div className="w-1 h-1 rounded-full bg-zinc-900" />
                            <span className="text-[11px] text-zinc-900 font-bold truncate">{sortedOverview.company.name}</span>
                          </div>
                        </td>
                        {/* Tháng hiện tại */}
                        <td className="px-1 py-1.5 text-[11px] font-bold text-right">{formatNumber(sortedOverview.company.monthActual)}</td>
                        <td className="px-1 py-1.5 text-[11px] text-zinc-500 text-right font-bold">{formatNumber(sortedOverview.company.monthPlan)}</td>
                        <td className="px-1 py-1.5">
                          <div className="flex items-center gap-1">
                            <MiniProgress percentage={sortedOverview.company.monthPerfVsPlan} />
                            <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                              sortedOverview.company.monthPerfVsPlan >= 100 ? "text-emerald-600" : sortedOverview.company.monthPerfVsPlan >= 80 ? "text-amber-600" : "text-rose-600"
                            )}>
                              {formatPercent(sortedOverview.company.monthPerfVsPlan)}
                            </span>
                          </div>
                        </td>
                        <td className="px-1 py-1.5 text-[11px] text-zinc-500 text-right font-bold">{formatNumber(sortedOverview.company.monthLastYear)}</td>
                        <td className="px-1 py-1.5 border-r border-zinc-50/50">
                          <div className="flex items-center gap-1">
                            <MiniProgress percentage={sortedOverview.company.monthPerfVsLastYear} />
                            <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                              sortedOverview.company.monthPerfVsLastYear >= 100 ? "text-emerald-600" : sortedOverview.company.monthPerfVsLastYear >= 80 ? "text-amber-600" : "text-rose-600"
                            )}>
                              {formatPercent(sortedOverview.company.monthPerfVsLastYear)}
                            </span>
                          </div>
                        </td>
                        {/* Lũy kế */}
                        <td className="px-1 py-1.5 text-[11px] font-bold text-right">{formatNumber(sortedOverview.company.actual)}</td>
                        <td className="px-1 py-1.5 text-[11px] text-zinc-500 text-right font-bold">{formatNumber(sortedOverview.company.plan)}</td>
                        <td className="px-1 py-1.5">
                          <div className="flex items-center gap-1">
                            <MiniProgress percentage={sortedOverview.company.perfVsPlan} />
                            <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                              sortedOverview.company.perfVsPlan >= 100 ? "text-emerald-600" : sortedOverview.company.perfVsPlan >= 80 ? "text-amber-600" : "text-rose-600"
                            )}>
                              {formatPercent(sortedOverview.company.perfVsPlan)}
                            </span>
                          </div>
                        </td>
                        <td className="px-1 py-1.5 text-[11px] text-zinc-500 text-right font-bold">{formatNumber(sortedOverview.company.lastYear)}</td>
                        <td className="px-1 py-1.5 border-r border-zinc-50/50">
                          <div className="flex items-center gap-1">
                            <MiniProgress percentage={sortedOverview.company.perfVsLastYear} />
                            <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                              sortedOverview.company.perfVsLastYear >= 100 ? "text-emerald-600" : sortedOverview.company.perfVsLastYear >= 80 ? "text-amber-600" : "text-rose-600"
                            )}>
                              {formatPercent(sortedOverview.company.perfVsLastYear)}
                            </span>
                          </div>
                        </td>
                        {/* Năm */}
                        <td className="px-1 py-1.5 text-[11px] text-zinc-500 text-right font-bold">{formatNumber(sortedOverview.company.annualPlan)}</td>
                        <td className="px-1 py-1.5">
                          <div className="flex items-center gap-1">
                            <MiniProgress percentage={sortedOverview.company.annualCompletion} />
                            <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                              sortedOverview.company.annualCompletion >= 100 ? "text-emerald-600" : sortedOverview.company.annualCompletion >= 80 ? "text-amber-600" : "text-rose-600"
                            )}>
                              {formatPercent(sortedOverview.company.annualCompletion)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                  {/* Center Groups (Separate Boxes) */}
                  <div className="grid grid-cols-1 gap-6">
                    {sortedOverview.centersSection.filter((d: any) => d.type === 'center').map((center: any) => (
                      <div key={center.id} className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <table className="w-full text-left border-separate border-spacing-0 table-fixed">
                        <colgroup>
                          <col className="w-[20%]" />
                          <col className="w-[6%]" />
                          <col className="w-[6%]" />
                          <col className="w-[7%]" />
                          <col className="w-[6%]" />
                          <col className="w-[7%]" />
                          <col className="w-[6%]" />
                          <col className="w-[6%]" />
                          <col className="w-[7%]" />
                          <col className="w-[6%]" />
                          <col className="w-[6%]" />
                          <col className="w-[7%]" />
                          <col className="w-[10%]" />
                        </colgroup>
                        <tbody className="divide-y divide-zinc-50">
                          {/* Center Row */}
                          <tr className="bg-blue-50/30 group hover:bg-blue-50/50 transition-colors cursor-pointer" onClick={() => {
                            setSelectedDeptId(center.id);
                            setViewMode('detail');
                          }}>
                            <td className="px-1.5 py-1.5 border-r border-zinc-50/50">
                              <div className="flex items-center gap-2 pl-4">
                                <div className="w-1 h-1 rounded-full bg-blue-500" />
                                <span className="text-[11px] text-zinc-900 font-bold truncate">{center.name}</span>
                              </div>
                            </td>
                            {/* Tháng hiện tại */}
                            <td className="px-1 py-1.5 text-[11px] font-bold text-right">{formatNumber(center.monthActual)}</td>
                            <td className="px-1 py-1.5 text-[11px] text-zinc-500 text-right font-bold">{formatNumber(center.monthPlan)}</td>
                            <td className="px-1 py-1.5">
                              <div className="flex items-center gap-1">
                                <MiniProgress percentage={center.monthPerfVsPlan} />
                                <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                  center.monthPerfVsPlan >= 100 ? "text-emerald-600" : center.monthPerfVsPlan >= 80 ? "text-amber-600" : "text-rose-600"
                                )}>
                                  {formatPercent(center.monthPerfVsPlan)}
                                </span>
                              </div>
                            </td>
                            <td className="px-1 py-1.5 text-[11px] text-zinc-500 text-right font-bold">{formatNumber(center.monthLastYear)}</td>
                            <td className="px-1 py-1.5 border-r border-zinc-50/50">
                              <div className="flex items-center gap-1">
                                <MiniProgress percentage={center.monthPerfVsLastYear} />
                                <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                  center.monthPerfVsLastYear >= 100 ? "text-emerald-600" : center.monthPerfVsLastYear >= 80 ? "text-amber-600" : "text-rose-600"
                                )}>
                                  {formatPercent(center.monthPerfVsLastYear)}
                                </span>
                              </div>
                            </td>
                            {/* Lũy kế */}
                            <td className="px-1 py-1.5 text-[11px] font-bold text-right">{formatNumber(center.actual)}</td>
                            <td className="px-1 py-1.5 text-[11px] text-zinc-500 text-right font-bold">{formatNumber(center.plan)}</td>
                            <td className="px-1 py-1.5">
                              <div className="flex items-center gap-1">
                                <MiniProgress percentage={center.perfVsPlan} />
                                <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                  center.perfVsPlan >= 100 ? "text-emerald-600" : center.perfVsPlan >= 80 ? "text-amber-600" : "text-rose-600"
                                )}>
                                  {formatPercent(center.perfVsPlan)}
                                </span>
                              </div>
                            </td>
                            <td className="px-1 py-1.5 text-[11px] text-zinc-500 text-right font-bold">{formatNumber(center.lastYear)}</td>
                            <td className="px-1 py-1.5 border-r border-zinc-50/50">
                              <div className="flex items-center gap-1">
                                <MiniProgress percentage={center.perfVsLastYear} />
                                <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                  center.perfVsLastYear >= 100 ? "text-emerald-600" : center.perfVsLastYear >= 80 ? "text-amber-600" : "text-rose-600"
                                )}>
                                  {formatPercent(center.perfVsLastYear)}
                                </span>
                              </div>
                            </td>
                            {/* Năm */}
                            <td className="px-1 py-1.5 text-[11px] text-zinc-500 text-right font-bold">{formatNumber(center.annualPlan)}</td>
                            <td className="px-1 py-1.5">
                              <div className="flex items-center gap-1">
                                <MiniProgress percentage={center.annualCompletion} />
                                <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                  center.annualCompletion >= 100 ? "text-emerald-600" : center.annualCompletion >= 80 ? "text-amber-600" : "text-rose-600"
                                )}>
                                  {formatPercent(center.annualCompletion)}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {/* Phong Rows */}
                          {center.phongs.map((phong: any) => (
                            <tr key={phong.id} className="group hover:bg-zinc-50/50 transition-colors cursor-pointer" onClick={() => {
                              setSelectedDeptId(phong.id);
                              setViewMode('detail');
                            }}>
                              <td className="px-1.5 py-1.5 border-r border-zinc-50/50">
                                <div className="flex items-center gap-2 pl-8">
                                  <div className="w-1 h-1 rounded-full bg-zinc-300" />
                                  <span className="text-[11px] text-zinc-600 font-normal truncate">{phong.name}</span>
                                </div>
                              </td>
                              {/* Tháng hiện tại */}
                              <td className="px-1 py-1.5 text-[11px] font-normal text-right">{formatNumber(phong.monthActual)}</td>
                              <td className="px-1 py-1.5 text-[11px] text-zinc-400 font-normal text-right">{formatNumber(phong.monthPlan)}</td>
                              <td className="px-1 py-1.5">
                                <div className="flex items-center gap-1">
                                  <MiniProgress percentage={phong.monthPerfVsPlan} />
                                  <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                    phong.monthPerfVsPlan >= 100 ? "text-emerald-600" : phong.monthPerfVsPlan >= 80 ? "text-amber-600" : "text-rose-600"
                                  )}>
                                    {formatPercent(phong.monthPerfVsPlan)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-1 py-1.5 text-[11px] text-zinc-400 font-normal text-right">{formatNumber(phong.monthLastYear)}</td>
                              <td className="px-1 py-1.5 border-r border-zinc-50/50">
                                <div className="flex items-center gap-1">
                                  <MiniProgress percentage={phong.monthPerfVsLastYear} />
                                  <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                    phong.monthPerfVsLastYear >= 100 ? "text-emerald-600" : phong.monthPerfVsLastYear >= 80 ? "text-amber-600" : "text-rose-600"
                                  )}>
                                    {formatPercent(phong.monthPerfVsLastYear)}
                                  </span>
                                </div>
                              </td>
                              {/* Lũy kế */}
                              <td className="px-1 py-1.5 text-[11px] font-normal text-right">{formatNumber(phong.actual)}</td>
                              <td className="px-1 py-1.5 text-[11px] text-zinc-400 font-normal text-right">{formatNumber(phong.plan)}</td>
                              <td className="px-1 py-1.5">
                                <div className="flex items-center gap-1">
                                  <MiniProgress percentage={phong.perfVsPlan} />
                                  <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                    phong.perfVsPlan >= 100 ? "text-emerald-600" : phong.perfVsPlan >= 80 ? "text-amber-600" : "text-rose-600"
                                  )}>
                                    {formatPercent(phong.perfVsPlan)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-1 py-1.5 text-[11px] text-zinc-400 font-normal text-right">{formatNumber(phong.lastYear)}</td>
                              <td className="px-1 py-1.5 border-r border-zinc-50/50">
                                <div className="flex items-center gap-1">
                                  <MiniProgress percentage={phong.perfVsLastYear} />
                                  <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                    phong.perfVsLastYear >= 100 ? "text-emerald-600" : phong.perfVsLastYear >= 80 ? "text-amber-600" : "text-rose-600"
                                  )}>
                                    {formatPercent(phong.perfVsLastYear)}
                                  </span>
                                </div>
                              </td>
                              {/* Năm */}
                              <td className="px-1 py-1.5 text-[11px] text-zinc-400 font-normal text-right">{formatNumber(phong.annualPlan)}</td>
                              <td className="px-1 py-1.5">
                                <div className="flex items-center gap-1">
                                  <MiniProgress percentage={phong.annualCompletion} />
                                  <span className={cn("text-[10px] font-bold min-w-[28px] text-right", 
                                    phong.annualCompletion >= 100 ? "text-emerald-600" : phong.annualCompletion >= 80 ? "text-amber-600" : "text-rose-600"
                                  )}>
                                    {formatPercent(phong.annualCompletion)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
    ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Dept Selector for Detail View */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-zinc-900">{selectedDept.name}</h2>
                <button 
                  onClick={() => setIsDeptMenuOpen(!isDeptMenuOpen)}
                  className="p-2 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"
                >
                  <ChevronDown size={18} className={cn("text-zinc-400 transition-transform", isDeptMenuOpen && "rotate-180")} />
                </button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Thực tế vs Kế hoạch" 
                value={stats.totalActual} 
                targetValue={stats.totalPlan} 
                type="plan"
              />
              <StatCard 
                title="Thực tế vs Cùng kỳ" 
                value={stats.totalActual} 
                targetValue={stats.totalLastYear} 
                type="lastYear"
              />
              <StatCard 
                title={`${months[selectedMonth]} vs KH`} 
                value={selectedDept.monthly[selectedMonth].actual} 
                targetValue={selectedDept.monthly[selectedMonth].plan} 
                type="plan"
              />
              <StatCard 
                title={`${months[selectedMonth]} vs CK`} 
                value={selectedDept.monthly[selectedMonth].actual} 
                targetValue={selectedDept.monthly[selectedMonth].lastYear} 
                type="lastYear"
              />
            </div>

            {/* Charts Section 1: Vs Plan */}
            <section className="space-y-6">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-6 bg-blue-500 rounded-full" />
                <h2 className="text-xl font-bold text-zinc-800">So sánh với Kế hoạch</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PerformanceChart 
                  data={selectedDept.monthly} 
                  title="Thực hiện theo tháng" 
                  type="monthly" 
                  compareWith="plan" 
                  selectedMonth={selectedMonth}
                />
                <PerformanceChart 
                  data={selectedDept.monthly} 
                  title="Lũy kế thực hiện" 
                  type="cumulative" 
                  compareWith="plan" 
                  selectedMonth={selectedMonth}
                />
              </div>
            </section>

            {/* Charts Section 2: Vs Last Year */}
            <section className="space-y-6">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-6 bg-zinc-400 rounded-full" />
                <h2 className="text-xl font-bold text-zinc-800">So sánh với Cùng kỳ năm trước</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PerformanceChart 
                  data={selectedDept.monthly} 
                  title="Thực hiện theo tháng" 
                  type="monthly" 
                  compareWith="lastYear" 
                  selectedMonth={selectedMonth}
                />
                <PerformanceChart 
                  data={selectedDept.monthly} 
                  title="Lũy kế thực hiện" 
                  type="cumulative" 
                  compareWith="lastYear" 
                  selectedMonth={selectedMonth}
                />
              </div>
            </section>
          </motion.div>
        )}
        </AnimatePresence>
      </main>

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
