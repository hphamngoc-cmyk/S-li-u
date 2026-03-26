import React, { useState, useRef, useMemo } from 'react';
import { X, Plus, Trash2, Save, AlertCircle, Download, Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DepartmentData, MonthlyData } from '../types';
import { cn, formatNumber } from '../utils';

interface DataEntryProps {
  data: DepartmentData[];
  onSave: (newData: DepartmentData[]) => void;
  onClose: () => void;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DataEntry: React.FC<DataEntryProps> = ({ data, onSave, onClose }) => {
  const [localData, setLocalData] = useState<DepartmentData[]>(JSON.parse(JSON.stringify(data)));
  const [activeDeptId, setActiveDeptId] = useState(data[0]?.id || 'all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDeptIndex = localData.findIndex(d => d.id === activeDeptId);
  const activeDept = localData[activeDeptIndex] || localData[0];

  const isParent = activeDept.type === 'company' || activeDept.type === 'center';

  const recalculateTotals = (data: DepartmentData[]) => {
    const newData = JSON.parse(JSON.stringify(data));
    
    const aggregate = (parentId: string) => {
      let children = newData.filter((d: any) => d.parentId === parentId);
      
      // If aggregating for Company, only include 'ban' types
      if (parentId === 'all') {
        children = children.filter((d: any) => d.type === 'ban');
      }

      const parent = newData.find((d: any) => d.id === parentId);
      if (!parent) return;

      parent.monthly = months.map((month: string, index: number) => {
        const actual = children.reduce((sum: number, c: any) => sum + c.monthly[index].actual, 0);
        const plan = children.reduce((sum: number, c: any) => sum + c.monthly[index].plan, 0);
        const lastYear = children.reduce((sum: number, c: any) => sum + c.monthly[index].lastYear, 0);
        return { month, actual, plan, lastYear };
      });
    };

    // 1. Aggregate Phongs to Centers
    const centers = newData.filter((d: any) => d.type === 'center');
    centers.forEach((c: any) => aggregate(c.id));
    
    // 2. Aggregate Centers and Bans to Company
    aggregate('all');

    return newData;
  };

  const sortedDepts = useMemo(() => {
    const result: DepartmentData[] = [];
    const company = localData.find(d => d.type === 'company');
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
  }, [localData]);

  const handleValueChange = (monthIndex: number, field: keyof Omit<MonthlyData, 'month'>, value: string) => {
    if (isParent) return; // Prevent editing parent data

    // Remove all dots to get the raw numeric string
    const rawValue = value.replace(/\./g, '');
    
    let numValue = 0;
    if (rawValue !== '') {
      numValue = parseInt(rawValue, 10);
      if (isNaN(numValue)) return;
    }

    const newData = [...localData];
    newData[activeDeptIndex].monthly[monthIndex][field] = numValue;
    
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
      id: `dept_${Date.now()}`,
      name: 'Bộ phận mới',
      type: 'phong',
      parentId: 'tmc', // Default to TMC center for new phongs
      monthly: months.map(m => ({ month: m, actual: 0, plan: 0, lastYear: 0 }))
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
      'Thực tế (Năm nay)': 0,
      'Kế hoạch (Năm nay)': 0,
      'Thực tế (Năm trước)': 0
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
          currentMonthly[mIdx] = {
            month: monthName,
            actual: parseInt(row['Thực tế (Năm nay)']) || 0,
            plan: parseInt(row['Kế hoạch (Năm nay)']) || 0,
            lastYear: parseInt(row['Thực tế (Năm trước)']) || 0
          };
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Khai báo số liệu</h2>
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
                  {dept.id !== 'all' && (
                    <button 
                      onClick={() => removeDepartment(dept.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-rose-500 opacity-0 group-hover:opacity-100 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button 
                onClick={addDepartment}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-zinc-200 rounded-xl text-sm font-bold text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-all"
              >
                <Plus size={16} />
                Thêm bộ phận
              </button>
            </div>
          </div>

          {/* Main Content: Monthly Data Table */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Tên bộ phận</label>
                  <input 
                    type="text" 
                    value={activeDept.name}
                    onChange={(e) => handleDeptNameChange(activeDept.id, e.target.value)}
                    disabled={activeDept.id === 'all'}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                  />
                </div>
                {activeDept.id !== 'all' && (
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
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-all"
                  title="Tải mẫu Excel"
                >
                  <Download size={18} />
                  Mẫu Excel
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-100 transition-all"
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

            {isParent && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3 text-amber-700">
                <AlertCircle size={18} className="flex-shrink-0" />
                <p className="text-xs font-medium">
                  Dữ liệu của <strong>{activeDept.name}</strong> được tự động tính toán từ các bộ phận trực thuộc. 
                  Bạn không thể chỉnh sửa trực tiếp tại đây.
                </p>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-100 text-zinc-900 font-bold uppercase text-[11px] tracking-widest border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-4">Tháng</th>
                    <th className="px-4 py-4 text-right">Thực tế (Năm nay)</th>
                    <th className="px-4 py-4 text-right">Kế hoạch (Năm nay)</th>
                    <th className="px-4 py-4 text-right">Thực tế (Năm trước)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {activeDept.monthly.map((m, idx) => (
                    <tr key={m.month} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-zinc-900">{m.month}</td>
                      <td className="px-4 py-3">
                        <input 
                          type="text" 
                          value={m.actual === 0 ? '0' : formatNumber(m.actual)}
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
                          value={m.plan === 0 ? '0' : formatNumber(m.plan)}
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
                          value={m.lastYear === 0 ? '0' : formatNumber(m.lastYear)}
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
