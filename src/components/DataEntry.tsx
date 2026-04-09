import React, { useState, useRef, useMemo, useEffect } from 'react';
import { X, Plus, Trash2, Save, AlertCircle, Download, Upload, FileSpreadsheet, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DepartmentData, MonthlyData } from '../types';
import { cn, formatNumber } from '../utils';

import { dataService, GoogleSheetConfig } from '../services/dataService';

interface DataEntryProps {
  data: DepartmentData[];
  year: number;
  initialTab?: 'revenue' | 'profit' | 'product';
  gsheetConfig?: GoogleSheetConfig | null;
  onSave: (newData: DepartmentData[]) => void;
  onClose: () => void;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DataEntry: React.FC<DataEntryProps> = ({ data, year, initialTab = 'revenue', gsheetConfig, onSave, onClose }) => {
  const [localData, setLocalData] = useState<DepartmentData[]>(JSON.parse(JSON.stringify(data)));
  const [activeDeptId, setActiveDeptId] = useState(data[0]?.id || 'all');
  const [entryTab, setEntryTab] = useState<'revenue' | 'profit' | 'product'>(initialTab);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Sync with external data changes (e.g. from Google Sheets sync)
  useEffect(() => {
    setLocalData(JSON.parse(JSON.stringify(data)));
  }, [data]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDeptIndex = localData.findIndex(d => d.id === activeDeptId);
  const activeDept = localData[activeDeptIndex] || localData[0];

  const isParent = entryTab === 'revenue' 
    ? (activeDept.type === 'company' || activeDept.type === 'center')
    : entryTab === 'profit'
      ? false
      : false; // In product tab, we edit products directly

  const recalculateTotals = (data: DepartmentData[]) => {
    const newData = JSON.parse(JSON.stringify(data));
    
    // 1. Aggregate Revenue (Actual/Plan/LastYear) from Phongs to Centers
    const centers = newData.filter((d: any) => d.type === 'center');
    centers.forEach((center: any) => {
      const children = newData.filter((d: any) => d.parentId === center.id);
      center.monthly = months.map((month: string, index: number) => {
        // As per user request: "doanh thu TMC bằng tổng các Phòng thuộc TMC cộng lại"
        // We ignore products here as they are handled independently in the Product tab
        const phongs = children.filter((c: any) => c.type === 'phong');

        const actual = phongs.reduce((sum: number, c: any) => sum + (c.monthly[index].actual || 0), 0);
        const plan = phongs.reduce((sum: number, c: any) => sum + (c.monthly[index].plan || 0), 0);
        const lastYear = phongs.reduce((sum: number, c: any) => sum + (c.monthly[index].lastYear || 0), 0);
        
        // Keep existing profit data for centers as it's entered directly in Profit tab
        return { 
          ...center.monthly[index],
          actual, 
          plan, 
          lastYear
        };
      });
    });
    
    // 2. Aggregate Company (both Revenue and Profit)
    const company = newData.find((d: any) => d.id === 'all');
    if (company) {
      const children = newData.filter((d: any) => d.parentId === 'all');
      company.monthly = months.map((month: string, index: number) => {
        // Revenue: Sum ONLY from Bans (as per user request: "Doanh thu công ty bằng tổng các ban trực thuộc, không cộng trung tâm")
        const bans = children.filter((d: any) => d.type === 'ban');
        const actual = bans.reduce((sum: number, c: any) => sum + (c.monthly[index].actual || 0), 0);
        const plan = bans.reduce((sum: number, c: any) => sum + (c.monthly[index].plan || 0), 0);
        const lastYear = bans.reduce((sum: number, c: any) => sum + (c.monthly[index].lastYear || 0), 0);

        // Profit: Only from Centers
        const centers = children.filter((d: any) => d.type === 'center');
        const profitActual = centers.reduce((sum: number, c: any) => sum + (c.monthly[index].profitActual || 0), 0);
        const profitPlan = centers.reduce((sum: number, c: any) => sum + (c.monthly[index].profitPlan || 0), 0);
        const profitLastYear = centers.reduce((sum: number, c: any) => sum + (c.monthly[index].profitLastYear || 0), 0);
        
        return { month, actual, plan, lastYear, profitActual, profitPlan, profitLastYear };
      });
    }

    return newData;
  };

  const sortedDepts = useMemo(() => {
    const result: DepartmentData[] = [];
    const company = localData.find(d => d.type === 'company');
    
    if (entryTab === 'profit') {
      // For profit, only show company and centers
      if (company) result.push(company);
      const centers = localData.filter(d => d.type === 'center');
      result.push(...centers);
      return result;
    }

    if (entryTab === 'product') {
      // For product tab, show TMC and its products
      const tmc = localData.find(d => d.id === 'tmc');
      if (tmc) result.push(tmc);
      const products = localData.filter(d => d.type === 'product' && d.parentId === 'tmc');
      result.push(...products);
      return result;
    }

    // For revenue, show everything
    if (company) result.push(company);

    const centers = localData.filter(d => d.type === 'center');
    centers.forEach(center => {
      result.push(center);
      const phongs = localData.filter(d => d.parentId === center.id);
      result.push(...phongs);
    });

    const bans = localData.filter(d => d.type === 'ban');
    result.push(...bans);

    // Add any others that might have been added manually
    localData.forEach(d => {
      if (!result.find(r => r.id === d.id)) {
        result.push(d);
      }
    });

    return result;
  }, [localData, entryTab]);

  // Ensure activeDeptId is valid for the current tab
  useEffect(() => {
    const isValid = sortedDepts.some(d => d.id === activeDeptId);
    if (!isValid && sortedDepts.length > 0) {
      setActiveDeptId(sortedDepts[0].id);
    }
  }, [entryTab, sortedDepts, activeDeptId]);

  const handleValueChange = (monthIndex: number, field: keyof Omit<MonthlyData, 'month'>, value: string) => {
    if (isParent) return; // Prevent editing parent data

    // Remove all dots (thousands) and replace comma with dot (decimal)
    const rawValue = value.replace(/\./g, '').replace(',', '.');
    
    let numValue = 0;
    if (rawValue !== '') {
      numValue = parseFloat(rawValue);
      if (isNaN(numValue)) return;
    }

    const newData = [...localData];
    const targetField = entryTab === 'profit' 
      ? (field === 'actual' ? 'profitActual' : field === 'plan' ? 'profitPlan' : 'profitLastYear')
      : field;
    
    (newData[activeDeptIndex].monthly[monthIndex] as any)[targetField] = numValue;
    
    // Recalculate all totals
    const aggregatedData = recalculateTotals(newData);
    setLocalData(aggregatedData);
  };

  const handleDeptNameChange = (id: string, name: string) => {
    const newData = localData.map(d => d.id === id ? { ...d, name } : d);
    setLocalData(newData);
  };

  const addDepartment = () => {
    const newDept: DepartmentData = {
      id: entryTab === 'product' ? `prod_${Date.now()}` : `dept_${Date.now()}`,
      name: entryTab === 'product' ? 'Sản phẩm mới' : 'Bộ phận mới',
      type: entryTab === 'product' ? 'product' : 'phong',
      parentId: 'tmc', // Default to TMC center
      monthly: months.map(m => ({ 
        month: m, 
        actual: 0, 
        plan: 0, 
        lastYear: 0,
        profitActual: 0,
        profitPlan: 0,
        profitLastYear: 0
      }))
    };
    const newData = [...localData, newDept];
    const aggregatedData = recalculateTotals(newData);
    setLocalData(aggregatedData);
    setActiveDeptId(newDept.id);
  };

  const removeDepartment = (id: string) => {
    if (id === 'all') return;
    const newData = localData.filter(d => d.id !== id);
    const aggregatedData = recalculateTotals(newData);
    setLocalData(aggregatedData);
    if (activeDeptId === id) {
      setActiveDeptId(newData[0]?.id || 'all');
    }
  };

  const downloadTemplate = () => {
    const templateData = months.map(m => ({
      'Tháng': m,
      'Doanh thu Thực tế': 0,
      'Doanh thu Kế hoạch': 0,
      'Doanh thu Cùng kỳ': 0,
      'Lợi nhuận Thực tế': 0,
      'Lợi nhuận Kế hoạch': 0,
      'Lợi nhuận Cùng kỳ': 0
    }));

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `Template_Khai_Bao_${localData[activeDeptIndex].name}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const importedData = XLSX.utils.sheet_to_json(ws) as any[];

      const newData = [...localData];
      const currentMonthly = [...newData[activeDeptIndex].monthly];

      importedData.forEach((row) => {
        const monthName = row['Tháng'];
        const mIdx = months.indexOf(monthName);
        if (mIdx !== -1) {
          if (entryTab === 'revenue') {
            currentMonthly[mIdx] = {
              ...currentMonthly[mIdx],
              actual: parseInt(row['Doanh thu Thực tế'] || row['Thực tế (Năm nay)']) || 0,
              plan: parseInt(row['Doanh thu Kế hoạch'] || row['Kế hoạch (Năm nay)']) || 0,
              lastYear: parseInt(row['Doanh thu Cùng kỳ'] || row['Thực tế (Năm trước)']) || 0
            };
          } else {
            currentMonthly[mIdx] = {
              ...currentMonthly[mIdx],
              profitActual: parseInt(row['Lợi nhuận Thực tế']) || 0,
              profitPlan: parseInt(row['Lợi nhuận Kế hoạch']) || 0,
              profitLastYear: parseInt(row['Lợi nhuận Cùng kỳ']) || 0
            };
          }
        }
      });

      newData[activeDeptIndex].monthly = currentMonthly;
      const aggregatedData = recalculateTotals(newData);
      setLocalData(aggregatedData);
      
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleSyncGSheet = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      // Sync the specific tab
      await dataService.syncWithGoogleSheet(entryTab);
      // Reload data for the current year
      const updatedData = dataService.getData(year);
      setLocalData(updatedData);
    } catch (err: any) {
      setSyncError(err.message || 'Đồng bộ thất bại');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetLocalData = () => {
    if (confirm(`Bạn có chắc chắn muốn xóa tất cả số liệu đang nhập của năm ${year}?`)) {
      const resetData = localData.map(dept => ({
        ...dept,
        monthly: dept.monthly.map(m => ({ 
          ...m, 
          actual: 0, plan: 0, lastYear: 0,
          profitActual: 0, profitPlan: 0, profitLastYear: 0
        }))
      }));
      setLocalData(resetData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">
              Khai báo {entryTab === 'revenue' ? 'Doanh thu' : 'Lợi nhuận'} - Năm {year}
            </h2>
            <p className="text-sm text-zinc-500">Thiết lập bộ phận và kế hoạch/thực tế các tháng</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar: Departments */}
          <div className="w-64 border-r border-zinc-100 p-4 overflow-y-auto bg-zinc-50/50">
            <div className="space-y-2">
              {sortedDepts.map((dept) => (
                <div key={dept.id} className="group relative">
                  <button
                    onClick={() => setActiveDeptId(dept.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                      activeDeptId === dept.id 
                        ? "bg-zinc-900 text-white shadow-lg" 
                        : "text-zinc-600 hover:bg-zinc-200",
                      dept.type === 'phong' && "pl-8"
                    )}
                  >
                    {dept.name}
                  </button>
                  {dept.id !== 'all' && (entryTab === 'revenue' || entryTab === 'product') && (
                    <button 
                      onClick={() => removeDepartment(dept.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-rose-500 opacity-0 group-hover:opacity-100 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {(entryTab === 'revenue' || entryTab === 'product') && (
                <button 
                  onClick={addDepartment}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-zinc-200 rounded-xl text-sm font-bold text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-all"
                >
                  <Plus size={16} />
                  {entryTab === 'product' ? 'Thêm sản phẩm' : 'Thêm bộ phận'}
                </button>
              )}
            </div>
          </div>

          {/* Main Content: Monthly Data Table */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl">
                <button
                  onClick={() => setEntryTab('revenue')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    entryTab === 'revenue' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  Doanh thu
                </button>
                <button
                  onClick={() => setEntryTab('profit')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    entryTab === 'profit' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  Lợi nhuận
                </button>
                <button
                  onClick={() => setEntryTab('product')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    entryTab === 'product' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  Sản phẩm TMC
                </button>
              </div>
              <div className="flex gap-2">
                {((entryTab === 'revenue' && gsheetConfig?.sheetId) || 
                  (entryTab === 'profit' && gsheetConfig?.profitSheetId) || 
                  (entryTab === 'product' && gsheetConfig?.productSheetId)) && (
                  <button 
                    onClick={handleSyncGSheet}
                    disabled={isSyncing}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                      isSyncing 
                        ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" 
                        : "bg-sky-50 border border-sky-100 text-sky-600 hover:bg-sky-100"
                    )}
                    title="Đồng bộ từ Google Sheet"
                  >
                    <RefreshCw size={18} className={cn(isSyncing && "animate-spin")} />
                    {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Sheet'}
                  </button>
                )}
                <button 
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-all"
                  title="Tải mẫu Excel"
                >
                  <Download size={18} />
                  Mẫu Excel
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-100 transition-all"
                  title="Nhập từ Excel"
                >
                  <Upload size={18} />
                  Nhập Excel
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImport} 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                />
              </div>
            </div>

            <div className="space-y-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                    {entryTab === 'product' ? 'Tên sản phẩm' : 'Tên bộ phận'}
                  </label>
                  <input 
                    type="text" 
                    value={activeDept.name}
                    onChange={(e) => handleDeptNameChange(activeDept.id, e.target.value)}
                    disabled={activeDept.id === 'all' || activeDept.id === 'tmc'}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                  />
                </div>
                {activeDept.id !== 'all' && activeDept.id !== 'tmc' && entryTab === 'revenue' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Loại</label>
                      <select
                        value={activeDept.type}
                        onChange={(e) => {
                          const newData = localData.map(d => d.id === activeDept.id ? { ...d, type: e.target.value as any } : d);
                          const aggregatedData = recalculateTotals(newData);
                          setLocalData(aggregatedData);
                        }}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                      >
                        <option value="center">Trung tâm</option>
                        <option value="ban">Ban</option>
                        <option value="phong">Phòng</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Trực thuộc</label>
                      <select
                        value={activeDept.parentId || ''}
                        onChange={(e) => {
                          const newData = localData.map(d => d.id === activeDept.id ? { ...d, parentId: e.target.value } : d);
                          const aggregatedData = recalculateTotals(newData);
                          setLocalData(aggregatedData);
                        }}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                      >
                        {localData.filter(d => d.id !== activeDept.id && (d.type === 'company' || d.type === 'center')).map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>

            {isParent && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3 text-amber-700">
                <AlertCircle size={18} className="flex-shrink-0" />
                <p className="text-xs font-medium">
                  Dữ liệu của <strong>{activeDept.name}</strong> được tự động tính toán từ các bộ phận trực thuộc. 
                  Bạn không thể chỉnh sửa trực tiếp tại đây.
                </p>
              </div>
            )}

            {syncError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-700">
                <AlertCircle size={18} className="flex-shrink-0" />
                <p className="text-xs font-medium">{syncError}</p>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-100 text-zinc-900 font-bold uppercase text-[11px] tracking-widest border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-4">Tháng</th>
                    <th className="px-4 py-4 text-right">{entryTab === 'profit' ? 'LN Thực tế' : 'Thực tế'} ({year})</th>
                    <th className="px-4 py-4 text-right">{entryTab === 'profit' ? 'LN Kế hoạch' : 'Kế hoạch'} ({year})</th>
                    <th className="px-4 py-4 text-right">{entryTab === 'profit' ? 'LN Cùng kỳ' : 'Thực tế'} ({year - 1})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {activeDept.monthly.map((m, idx) => (
                    <tr key={m.month} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-zinc-900">{m.month}</td>
                      <td className="px-4 py-3">
                        <input 
                          type="text" 
                          value={(entryTab === 'profit' ? (m.profitActual || 0) : m.actual) === 0 ? '0' : formatNumber(entryTab === 'profit' ? (m.profitActual || 0) : m.actual)}
                          onChange={(e) => handleValueChange(idx, 'actual', e.target.value)}
                          disabled={isParent}
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg outline-none text-right font-medium transition-all",
                            isParent 
                              ? "bg-zinc-50 border-zinc-100 text-zinc-400 cursor-not-allowed" 
                              : "bg-white border-zinc-200 focus:ring-2 focus:ring-zinc-900 text-zinc-900"
                          )}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="text" 
                          value={(entryTab === 'profit' ? (m.profitPlan || 0) : m.plan) === 0 ? '0' : formatNumber(entryTab === 'profit' ? (m.profitPlan || 0) : m.plan)}
                          onChange={(e) => handleValueChange(idx, 'plan', e.target.value)}
                          disabled={isParent}
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg outline-none text-right font-medium transition-all",
                            isParent 
                              ? "bg-zinc-50 border-zinc-100 text-zinc-400 cursor-not-allowed" 
                              : "bg-white border-zinc-200 focus:ring-2 focus:ring-zinc-900 text-zinc-900"
                          )}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="text" 
                          value={(entryTab === 'profit' ? (m.profitLastYear || 0) : m.lastYear) === 0 ? '0' : formatNumber(entryTab === 'profit' ? (m.profitLastYear || 0) : m.lastYear)}
                          onChange={(e) => handleValueChange(idx, 'lastYear', e.target.value)}
                          disabled={isParent}
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg outline-none text-right font-medium transition-all",
                            isParent 
                              ? "bg-zinc-50 border-zinc-100 text-zinc-400 cursor-not-allowed" 
                              : "bg-white border-zinc-200 focus:ring-2 focus:ring-zinc-900 text-zinc-900"
                          )}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-end gap-3 bg-zinc-50">
          <button 
            onClick={handleResetLocalData}
            className="px-6 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all"
          >
            Reset số liệu
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={() => onSave(localData)}
            className="flex items-center gap-2 px-8 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 shadow-lg shadow-zinc-200 transition-all"
          >
            <Save size={18} />
            Lưu dữ liệu
          </button>
        </div>
      </div>
    </div>
  );
};
