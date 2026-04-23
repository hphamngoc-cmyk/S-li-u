import { DepartmentData, MonthlyData } from '../types';

const STORAGE_PREFIX = 'corporate_dashboard_data_';

const initialMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const YEARS_STORAGE_KEY = 'corporate_dashboard_years';
const GOOGLE_SHEET_CONFIG_KEY = 'corporate_dashboard_gsheet_config';

export interface GoogleSheetConfig {
  sheetId: string; // Revenue sheet
  profitSheetId?: string; // Profit sheet
  productSheetId?: string; // Product sheet
  lastSync?: string;
  lastProfitSync?: string;
  lastProductSync?: string;
  autoSync: boolean;
}

const generateInitialData = (year: number): DepartmentData[] => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const createEmptyMonthly = () => months.map((month) => ({
    month,
    actual: 0,
    plan: 0,
    lastYear: 0,
    profitActual: 0,
    profitPlan: 0,
    profitLastYear: 0,
    netRevenueActual: 0,
    netRevenuePlan: 0,
    netRevenueLastYear: 0,
    expenseActual: 0,
    expensePlan: 0,
    expenseLastYear: 0,
    pbtActual: 0,
    pbtPlan: 0,
    pbtLastYear: 0,
    ebitdaActual: 0,
    ebitdaPlan: 0,
    ebitdaLastYear: 0
  }));

  const rawData: any[] = [
    { id: 'all', name: 'CÔNG TY', type: 'company' },
    // Centers
    { id: 'tmc', name: 'TMC', type: 'center', parentId: 'all' },
    { id: 'nura_hn', name: 'NURA HN', type: 'center', parentId: 'all' },
    { id: 'nura_hcm', name: 'NURA HCM', type: 'center', parentId: 'all' },
    // Bans (Directly under Company)
    { id: 'telesales', name: 'TELESALES', type: 'ban', parentId: 'all' },
    { id: 'hunt1', name: 'HUNT1', type: 'ban', parentId: 'all' },
    { id: 'hunt2', name: 'HUNT2', type: 'ban', parentId: 'all' },
    { id: 'partnership', name: 'PARTNERSHIP', type: 'ban', parentId: 'all' },
    { id: 'farm', name: 'FARM', type: 'ban', parentId: 'all' },
    { id: 'nha_thuoc', name: 'NHÀ THUỐC', type: 'ban', parentId: 'all' },
    // Phongs under TMC
    { id: 'tmc_telesales', name: 'TELESALES', type: 'phong', parentId: 'tmc' },
    { id: 'tmc_hunt1', name: 'HUNT1', type: 'phong', parentId: 'tmc' },
    { id: 'tmc_hunt2', name: 'HUNT2', type: 'phong', parentId: 'tmc' },
    { id: 'tmc_partnership', name: 'PARTNERSHIP', type: 'phong', parentId: 'tmc' },
    { id: 'tmc_farm', name: 'FARM', type: 'phong', parentId: 'tmc' },
    // Phongs under NURA HN
    { id: 'nura_hn_telesales', name: 'TELESALES', type: 'phong', parentId: 'nura_hn' },
    { id: 'nura_hn_hunt1', name: 'HUNT1', type: 'phong', parentId: 'nura_hn' },
    { id: 'nura_hn_hunt2', name: 'HUNT2', type: 'phong', parentId: 'nura_hn' },
    { id: 'nura_hn_partnership', name: 'PARTNERSHIP', type: 'phong', parentId: 'nura_hn' },
    { id: 'nura_hn_farm', name: 'FARM', type: 'phong', parentId: 'nura_hn' },
    // Phongs under NURA HCM
    { id: 'nura_hcm_telesales', name: 'TELESALES', type: 'phong', parentId: 'nura_hcm' },
    { id: 'nura_hcm_hunt1', name: 'HUNT1', type: 'phong', parentId: 'nura_hcm' },
    { id: 'nura_hcm_hunt2', name: 'HUNT2', type: 'phong', parentId: 'nura_hcm' },
    { id: 'nura_hcm_partnership', name: 'PARTNERSHIP', type: 'phong', parentId: 'nura_hcm' },
    { id: 'nura_hcm_farm', name: 'FARM', type: 'phong', parentId: 'nura_hcm' },
    // Products under TMC
    { id: 'tmc_prod1', name: 'SẢN PHẨM A', type: 'product', parentId: 'tmc' },
    { id: 'tmc_prod2', name: 'SẢN PHẨM B', type: 'product', parentId: 'tmc' },
    { id: 'tmc_prod3', name: 'SẢN PHẨM C', type: 'product', parentId: 'tmc' },
  ];

  const result: DepartmentData[] = rawData.map(d => ({
    id: d.id,
    name: d.name,
    type: d.type,
    parentId: d.parentId,
    monthly: createEmptyMonthly()
  }));

  return result;
};

export const dataService = {
  getData: (year: number): DepartmentData[] => {
    const storageKey = `${STORAGE_PREFIX}${year}`;
    let stored = localStorage.getItem(storageKey);
    let data: DepartmentData[];
    
    if (stored) {
      try {
        data = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored data', e);
        data = generateInitialData(year);
      }
    } else {
      data = generateInitialData(year);
    }

    // Automatically update 'lastYear' data from the previous year's 'actual'
    const prevYear = year - 1;
    const prevYearStorageKey = `${STORAGE_PREFIX}${prevYear}`;
    const prevYearStored = localStorage.getItem(prevYearStorageKey);

    if (prevYearStored) {
      try {
        const prevYearData: DepartmentData[] = JSON.parse(prevYearStored);
        data = data.map(dept => {
          const prevDept = prevYearData.find(pd => pd.id === dept.id);
          if (prevDept) {
            const updatedMonthly = dept.monthly.map((m, idx) => {
              const prevActual = prevDept.monthly[idx]?.actual || 0;
              const prevProfitActual = prevDept.monthly[idx]?.profitActual || 0;
              // Only overwrite if the current lastYear is 0 and prevActual is > 0
              // or if the user explicitly wants the automation.
              // We'll prefer the previous year's actual if it's available.
              return {
                ...m,
                lastYear: prevActual > 0 ? prevActual : m.lastYear,
                profitLastYear: prevProfitActual > 0 ? prevProfitActual : (m.profitLastYear || 0)
              };
            });
            return { ...dept, monthly: updatedMonthly };
          }
          return dept;
        });
      } catch (e) {
        console.error('Failed to parse previous year data', e);
      }
    }
    
    const recalculated = dataService.recalculateTotals(data);
    localStorage.setItem(storageKey, JSON.stringify(recalculated));
    return recalculated;
  },

  getYears: (): number[] => {
    const currentYear = new Date().getFullYear();
    const stored = localStorage.getItem(YEARS_STORAGE_KEY);
    if (stored) {
      const years = JSON.parse(stored);
      if (!years.includes(currentYear)) {
        years.push(currentYear);
        years.sort((a, b) => b - a);
        localStorage.setItem(YEARS_STORAGE_KEY, JSON.stringify(years));
      }
      return years;
    }
    return [currentYear];
  },

  addYear: (year: number) => {
    const years = dataService.getYears();
    if (!years.includes(year)) {
      years.push(year);
      years.sort((a, b) => b - a);
      localStorage.setItem(YEARS_STORAGE_KEY, JSON.stringify(years));
    }
  },

  deleteYear: (year: number) => {
    const years = dataService.getYears();
    const updatedYears = years.filter(y => y !== year);
    localStorage.setItem(YEARS_STORAGE_KEY, JSON.stringify(updatedYears));
    localStorage.removeItem(`${STORAGE_PREFIX}${year}`);
  },

  getGoogleSheetConfig: (): GoogleSheetConfig | null => {
    const stored = localStorage.getItem(GOOGLE_SHEET_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  saveGoogleSheetConfig: (config: GoogleSheetConfig) => {
    localStorage.setItem(GOOGLE_SHEET_CONFIG_KEY, JSON.stringify(config));
  },

  fetchFromGoogleSheet: async (sheetId: string, type: 'revenue' | 'profit' | 'product' = 'revenue'): Promise<{ years: number[], dataByYear: Record<number, DepartmentData[]>, updatedDeptIdsByYear: Record<number, Set<string>> }> => {
    // Extract ID and GID from URL if present
    let cleanId = sheetId.trim();
    let gid = '0';

    if (sheetId.includes('/d/')) {
      const parts = sheetId.split('/d/');
      if (parts[1]) {
        const idPart = parts[1].split('/')[0];
        // Handle /d/e/ format for published sheets
        if (idPart === 'e' && parts[1].split('/')[1]) {
          cleanId = parts[1].split('/')[1];
        } else {
          cleanId = idPart;
        }
      }
    }
    
    const gidMatch = sheetId.match(/gid=([0-9]+)/);
    if (gidMatch) gid = gidMatch[1];

    // Try multiple URL formats for better compatibility
    const urls = [
      `https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${cleanId}/pub?output=csv&gid=${gid}`
    ];

    // If it's already a direct CSV link, try it first
    if (sheetId.includes('format=csv') || sheetId.includes('output=csv')) {
      urls.unshift(sheetId);
    }
    
    let lastError: any = null;
    let csvText = '';

    console.log(`Attempting to fetch ${type} data from Google Sheet. ID: ${cleanId}, GID: ${gid}`);

    for (const url of urls) {
      try {
        console.log(`Trying URL: ${url}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`URL failed with status: ${response.status}`);
          continue;
        }
        
        const text = await response.text();
        if (text.includes('<!DOCTYPE html>') || text.includes('login')) {
          console.warn(`URL returned HTML instead of CSV. Likely permission issue.`);
          continue;
        }
        
        csvText = text;
        console.log(`Successfully fetched CSV data from ${url}`);
        break; // Found a working URL
      } catch (e: any) {
        console.error(`Error fetching from ${url}:`, e);
        if (e.name === 'AbortError') {
          lastError = new Error('Yêu cầu quá hạn (Timeout). Vui lòng kiểm tra kết nối mạng.');
        } else {
          lastError = e;
        }
      }
    }

    if (!csvText) {
      if (lastError?.name === 'TypeError' && lastError?.message === 'Failed to fetch') {
        const sheetName = type === 'revenue' ? 'Doanh thu' : type === 'profit' ? 'Lợi nhuận' : 'Sản phẩm';
        throw new Error(`Không thể kết nối tới Google Sheet ${sheetName}.\n\nLƯU Ý QUAN TRỌNG:\n1. Bạn PHẢI nhấn nút "Chia sẻ" (Share) -> "Bất kỳ ai có liên kết" (Anyone with the link) -> "Người xem" (Viewer).\n2. Nếu đã chia sẻ mà vẫn lỗi, hãy thử "Xuất bản lên web" (File -> Share -> Publish to web) và dán link vào đây.\n3. Đảm bảo ID Sheet chính xác.`);
      }
      const sheetName = type === 'revenue' ? 'Doanh thu' : type === 'profit' ? 'Lợi nhuận' : 'Sản phẩm';
      throw lastError || new Error(`Không thể tải dữ liệu ${sheetName}. Vui lòng kiểm tra lại quyền chia sẻ.`);
    }

    const lines = csvText.split('\n').map(line => {
      // Handle quoted values which might contain commas
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    });

    // Expected Header: Year, DeptID, Month, Actual, Plan, LastYear
    const headers = lines[0].map(h => h.toLowerCase().replace(/\s/g, ''));
    const yearIdx = headers.findIndex(h => h.includes('year') || h.includes('năm'));
    const deptIdIdx = headers.findIndex(h => h.includes('deptid') || h.includes('mãbộphận') || h.includes('id'));
    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('tên'));
    const monthIdx = headers.findIndex(h => h.includes('month') || h.includes('tháng'));
    const actualIdx = headers.findIndex(h => h.includes('actual') || h.includes('thựctế'));
    const planIdx = headers.findIndex(h => h.includes('plan') || h.includes('kếhoạch') || h.includes('kh'));
    const lastYearIdx = headers.findIndex(h => h.includes('lastyear') || h.includes('cùngkỳ') || h.includes('ck'));
    const profitActualIdx = headers.findIndex(h => h.includes('profitactual') || h.includes('lợinhuậnthựctế') || h.includes('lnthựctế'));
    const profitPlanIdx = headers.findIndex(h => h.includes('profitplan') || h.includes('lợinhuậnkếhoạch') || h.includes('lnkh'));
    const profitLastYearIdx = headers.findIndex(h => h.includes('profitlastyear') || h.includes('lợinhuậncùngkỳ') || h.includes('lnck'));
    
    // New Profit Indicators
    const netRevenueActualIdx = headers.findIndex(h => h.includes('netrevenueactual') || h.includes('doanhthuthuầnthựctế') || h.includes('dtthuầnthựctế') || h.includes('doanhthuthựctế'));
    const netRevenuePlanIdx = headers.findIndex(h => h.includes('netrevenueplan') || h.includes('doanhthuthuầnkếhoạch') || h.includes('dtthuầnkh') || h.includes('doanhthukh'));
    const netRevenueLastYearIdx = headers.findIndex(h => h.includes('netrevenuelastyear') || h.includes('doanhthuthuầncùngkỳ') || h.includes('dtthuầnck') || h.includes('doanhthuck'));
    
    const expenseActualIdx = headers.findIndex(h => h.includes('expenseactual') || h.includes('chiphíthựctế') || h.includes('cpthựctế'));
    const expensePlanIdx = headers.findIndex(h => h.includes('expenseplan') || h.includes('chiphíkếhoạch') || h.includes('cpkh'));
    const expenseLastYearIdx = headers.findIndex(h => h.includes('expenselastyear') || h.includes('chiphícùngkỳ') || h.includes('cpck'));
    
    const pbtActualIdx = headers.findIndex(h => h.includes('pbtactual') || h.includes('lợinhuậntrướcthuếthựctế') || h.includes('lnttthựctế') || h.includes('lợinhuậnthựctế'));
    const pbtPlanIdx = headers.findIndex(h => h.includes('pbtplan') || h.includes('lợinhuậntrướcthuếkếhoạch') || h.includes('lnttkh') || h.includes('lợinhuậnkh'));
    const pbtLastYearIdx = headers.findIndex(h => h.includes('pbtlastyear') || h.includes('lợinhuậntrướcthuếcùngkỳ') || h.includes('lnttck') || h.includes('lợinhuậnck'));
    
    const ebitdaActualIdx = headers.findIndex(h => h.includes('ebitdaactual') || h.includes('ebitdathựctế'));
    const ebitdaPlanIdx = headers.findIndex(h => h.includes('ebitdaplan') || h.includes('ebitdakếhoạch'));
    const ebitdaLastYearIdx = headers.findIndex(h => h.includes('ebitdalastyear') || h.includes('ebitdacùngkỳ'));

    if (yearIdx === -1 || (deptIdIdx === -1 && nameIdx === -1) || monthIdx === -1) {
      throw new Error('Cấu trúc file không đúng. Cần có các cột: Year, DeptID (hoặc Name), Month, Actual, Plan, LastYear');
    }

    const dataByYear: Record<number, DepartmentData[]> = {};
    const updatedDeptIdsByYear: Record<number, Set<string>> = {};
    const yearsSet = new Set<number>();

    const getMonthIndex = (val: string): number => {
      if (!val) return -1;
      const clean = val.toLowerCase().trim();
      
      const monthMap: Record<string, number> = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
        'tháng 1': 0, 'tháng 2': 1, 'tháng 3': 2, 'tháng 4': 3, 'tháng 5': 4, 'tháng 6': 5,
        'tháng 7': 6, 'tháng 8': 7, 'tháng 9': 8, 'tháng 10': 9, 'tháng 11': 10, 'tháng 12': 11,
        'tháng 01': 0, 'tháng 02': 1, 'tháng 03': 2, 'tháng 04': 3, 'tháng 05': 4, 'tháng 06': 5,
        'tháng 07': 6, 'tháng 08': 7, 'tháng 09': 8,
        't1': 0, 't2': 1, 't3': 2, 't4': 3, 't5': 4, 't6': 5, 't7': 6, 't8': 7, 't9': 8, 't10': 9, 't11': 10, 't12': 11
      };

      if (monthMap[clean] !== undefined) return monthMap[clean];
      
      // Try numeric
      const num = parseInt(clean.replace(/[^0-9]/g, ''));
      if (!isNaN(num) && num >= 1 && num <= 12) return num - 1;
      
      // Try English prefix
      for (let i = 0; i < initialMonths.length; i++) {
        if (clean.startsWith(initialMonths[i].toLowerCase())) return i;
      }

      return -1;
    };

    const parseLocaleNumber = (val: string): number => {
      if (!val) return 0;
      let clean = val.trim();
      
      const hasComma = val.includes(',');
      const hasDot = val.includes('.');
      
      if (hasComma) {
        return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
      } else if (hasDot) {
        const parts = val.split('.');
        if (parts[parts.length - 1].length === 3) {
          return parseFloat(val.replace(/\./g, '')) || 0;
        }
        return parseFloat(val) || 0;
      }
      
      return parseFloat(val) || 0;
    };

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length < 3 || !row[yearIdx]) continue;

      const year = parseInt(row[yearIdx]);
      const deptId = deptIdIdx !== -1 ? row[deptIdIdx]?.trim() : '';
      const nameValue = nameIdx !== -1 ? row[nameIdx]?.trim() : '';
      const monthName = row[monthIdx]?.trim();
      const actual = parseLocaleNumber(row[actualIdx]);
      const plan = parseLocaleNumber(row[planIdx]);
      const lastYear = parseLocaleNumber(row[lastYearIdx]);
      const profitActual = profitActualIdx !== -1 ? parseLocaleNumber(row[profitActualIdx]) : 0;
      const profitPlan = profitPlanIdx !== -1 ? parseLocaleNumber(row[profitPlanIdx]) : 0;
      const profitLastYear = profitLastYearIdx !== -1 ? parseLocaleNumber(row[profitLastYearIdx]) : 0;

      const netRevenueActual = netRevenueActualIdx !== -1 ? parseLocaleNumber(row[netRevenueActualIdx]) : 0;
      const netRevenuePlan = netRevenuePlanIdx !== -1 ? parseLocaleNumber(row[netRevenuePlanIdx]) : 0;
      const netRevenueLastYear = netRevenueLastYearIdx !== -1 ? parseLocaleNumber(row[netRevenueLastYearIdx]) : 0;
      
      const expenseActual = expenseActualIdx !== -1 ? parseLocaleNumber(row[expenseActualIdx]) : 0;
      const expensePlan = expensePlanIdx !== -1 ? parseLocaleNumber(row[expensePlanIdx]) : 0;
      const expenseLastYear = expenseLastYearIdx !== -1 ? parseLocaleNumber(row[expenseLastYearIdx]) : 0;
      
      const pbtActual = pbtActualIdx !== -1 ? parseLocaleNumber(row[pbtActualIdx]) : 0;
      const pbtPlan = pbtPlanIdx !== -1 ? parseLocaleNumber(row[pbtPlanIdx]) : 0;
      const pbtLastYear = pbtLastYearIdx !== -1 ? parseLocaleNumber(row[pbtLastYearIdx]) : 0;
      
      const ebitdaActual = ebitdaActualIdx !== -1 ? parseLocaleNumber(row[ebitdaActualIdx]) : 0;
      const ebitdaPlan = ebitdaPlanIdx !== -1 ? parseLocaleNumber(row[ebitdaPlanIdx]) : 0;
      const ebitdaLastYear = ebitdaLastYearIdx !== -1 ? parseLocaleNumber(row[ebitdaLastYearIdx]) : 0;

      if (isNaN(year) || (!deptId && !nameValue)) continue;
      yearsSet.add(year);

      if (!dataByYear[year]) {
        // Use existing data if available, otherwise use initial data
        const storageKey = `${STORAGE_PREFIX}${year}`;
        const existing = localStorage.getItem(storageKey);
        if (existing) {
          dataByYear[year] = JSON.parse(existing);
        } else {
          dataByYear[year] = generateInitialData(year);
        }
        updatedDeptIdsByYear[year] = new Set<string>();
      }

      // Try matching by ID first, then by Name
      let dept = dataByYear[year].find(d => d.id.toLowerCase() === deptId.toLowerCase());
      if (!dept && nameValue) {
        dept = dataByYear[year].find(d => d.name.toLowerCase() === nameValue.toLowerCase());
      }
      if (!dept && deptId) {
        dept = dataByYear[year].find(d => d.name.toLowerCase() === deptId.toLowerCase());
      }

      // If still not found, create a new department/product from sync
      if (!dept) {
        const newName = nameValue || deptId;
        if (newName) {
          const isProduct = type === 'product' || deptId.startsWith('prod_');
          const isCenter = type === 'profit' && (deptId.toLowerCase().includes('center') || deptId.toLowerCase().includes('trungtam'));
          
          const newDept: DepartmentData = {
            id: deptId || `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: newName,
            type: isProduct ? 'product' : (isCenter ? 'center' : (type === 'profit' ? 'center' : 'phong')),
            parentId: isProduct ? 'tmc' : 'all',
            monthly: initialMonths.map(m => ({
              month: m,
              actual: 0,
              plan: 0,
              lastYear: 0,
              profitActual: 0,
              profitPlan: 0,
              profitLastYear: 0
            }))
          };
          dataByYear[year].push(newDept);
          dept = newDept;
          console.log(`Created new ${newDept.type} from ${type} sync: ${newName}`);
        }
      }

      if (dept) {
        const mIdx = getMonthIndex(monthName);
        if (mIdx !== -1) {
          updatedDeptIdsByYear[year].add(dept.id);
          if (type === 'revenue' || type === 'product') {
            dept.monthly[mIdx] = { 
              ...dept.monthly[mIdx],
              month: initialMonths[mIdx], 
              actual, 
              plan, 
              lastYear
            };
          } else {
            dept.monthly[mIdx] = { 
              ...dept.monthly[mIdx],
              month: initialMonths[mIdx], 
              profitActual: profitActualIdx !== -1 ? profitActual : actual,
              profitPlan: profitPlanIdx !== -1 ? profitPlan : plan,
              profitLastYear: profitLastYearIdx !== -1 ? profitLastYear : lastYear,
              netRevenueActual: netRevenueActualIdx !== -1 ? netRevenueActual : (actual && type === 'profit' ? actual : 0),
              netRevenuePlan: netRevenuePlanIdx !== -1 ? netRevenuePlan : (plan && type === 'profit' ? plan : 0),
              netRevenueLastYear: netRevenueLastYearIdx !== -1 ? netRevenueLastYear : (lastYear && type === 'profit' ? lastYear : 0),
              expenseActual: expenseActualIdx !== -1 ? expenseActual : 0,
              expensePlan: expensePlanIdx !== -1 ? expensePlan : 0,
              expenseLastYear: expenseLastYearIdx !== -1 ? expenseLastYear : 0,
              pbtActual: pbtActualIdx !== -1 ? pbtActual : 0,
              pbtPlan: pbtPlanIdx !== -1 ? pbtPlan : 0,
              pbtLastYear: pbtLastYearIdx !== -1 ? pbtLastYear : 0,
              ebitdaActual: ebitdaActualIdx !== -1 ? ebitdaActual : 0,
              ebitdaPlan: ebitdaPlanIdx !== -1 ? ebitdaPlan : 0,
              ebitdaLastYear: ebitdaLastYearIdx !== -1 ? ebitdaLastYear : 0
            };
          }
        }
      }
    }

    // Recalculate totals for each year
    Object.keys(dataByYear).forEach(yearStr => {
      const year = parseInt(yearStr);
      dataByYear[year] = dataService.recalculateTotals(dataByYear[year]);
    });

    return {
      years: Array.from(yearsSet).sort((a, b) => b - a),
      dataByYear,
      updatedDeptIdsByYear
    };
  },

  syncWithGoogleSheet: async (type?: 'revenue' | 'profit' | 'product') => {
    const config = dataService.getGoogleSheetConfig();
    if (!config) return null;

    const syncRevenue = !type || type === 'revenue';
    const syncProfit = !type || type === 'profit';
    const syncProduct = !type || type === 'product';

    try {
      let allYears = new Set<number>(dataService.getYears());
      
      if (syncRevenue && config.sheetId) {
        const { years, dataByYear } = await dataService.fetchFromGoogleSheet(config.sheetId, 'revenue');
        years.forEach(y => allYears.add(y));
        
        Object.entries(dataByYear).forEach(([yearStr, data]) => {
          const year = parseInt(yearStr);
          const storageKey = `${STORAGE_PREFIX}${year}`;
          localStorage.setItem(storageKey, JSON.stringify(data));
        });
        config.lastSync = new Date().toISOString();
      }

      if (syncProfit && config.profitSheetId) {
        const { years, dataByYear } = await dataService.fetchFromGoogleSheet(config.profitSheetId, 'profit');
        years.forEach(y => allYears.add(y));

        Object.entries(dataByYear).forEach(([yearStr, data]) => {
          const year = parseInt(yearStr);
          const storageKey = `${STORAGE_PREFIX}${year}`;
          localStorage.setItem(storageKey, JSON.stringify(data));
        });
        config.lastProfitSync = new Date().toISOString();
      }

      if (syncProduct && config.productSheetId) {
        const { years, dataByYear } = await dataService.fetchFromGoogleSheet(config.productSheetId, 'product');
        years.forEach(y => allYears.add(y));

        Object.entries(dataByYear).forEach(([yearStr, data]) => {
          const year = parseInt(yearStr);
          const storageKey = `${STORAGE_PREFIX}${year}`;
          localStorage.setItem(storageKey, JSON.stringify(data));
        });
        config.lastProductSync = new Date().toISOString();
      }

      const yearsArray = Array.from(allYears).sort((a, b) => b - a);
      localStorage.setItem(YEARS_STORAGE_KEY, JSON.stringify(yearsArray));
      dataService.saveGoogleSheetConfig(config);

      return { years: yearsArray };
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  },

  clearAllData: () => {
    const years = dataService.getYears();
    years.forEach(year => {
      localStorage.removeItem(`${STORAGE_PREFIX}${year}`);
    });
    localStorage.removeItem('corporate_dashboard_data');
    
    // Also reset the years list to just the current year
    const currentYear = new Date().getFullYear();
    localStorage.setItem(YEARS_STORAGE_KEY, JSON.stringify([currentYear]));
  },

  recalculateTotals: (data: DepartmentData[]): DepartmentData[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const newData = JSON.parse(JSON.stringify(data));

    const aggregate = (parentId: string) => {
      const children = newData.filter((d: any) => d.parentId === parentId);
      const parent = newData.find((d: any) => d.id === parentId);
      if (!parent) return;

      parent.monthly = months.map((month, index) => {
        if (parent.id === 'all') {
          // Revenue: Sum ONLY from Bans (as per user request: "Doanh thu công ty bằng tổng các ban trực thuộc, không cộng trung tâm")
          const bans = children.filter((d: any) => d.type === 'ban');
          const actual = bans.reduce((sum: number, c: any) => sum + (c.monthly[index].actual || 0), 0);
          const plan = bans.reduce((sum: number, c: any) => sum + (c.monthly[index].plan || 0), 0);
          const lastYear = bans.reduce((sum: number, c: any) => sum + (c.monthly[index].lastYear || 0), 0);

          return { 
            ...parent.monthly[index],
            month, actual, plan, lastYear 
          };
        } else if (parent.type === 'center') {
          // Aggregate Phongs to Centers for Revenue
          const phongs = children.filter((c: any) => c.type === 'phong');
          const actual = phongs.reduce((sum: number, c: any) => sum + (c.monthly[index].actual || 0), 0);
          const plan = phongs.reduce((sum: number, c: any) => sum + (c.monthly[index].plan || 0), 0);
          const lastYear = phongs.reduce((sum: number, c: any) => sum + (c.monthly[index].lastYear || 0), 0);

          return {
            ...parent.monthly[index],
            month, actual, plan, lastYear
          };
        } else {
          // Group (e.g. Products to TMC if grouped)
          const actual = children.reduce((sum: number, c: any) => sum + (c.monthly[index].actual || 0), 0);
          const plan = children.reduce((sum: number, c: any) => sum + (c.monthly[index].plan || 0), 0);
          const lastYear = children.reduce((sum: number, c: any) => sum + (c.monthly[index].lastYear || 0), 0);
          const profitActual = children.reduce((sum: number, c: any) => sum + (c.monthly[index].profitActual || 0), 0);
          const profitPlan = children.reduce((sum: number, c: any) => sum + (c.monthly[index].profitPlan || 0), 0);
          const profitLastYear = children.reduce((sum: number, c: any) => sum + (c.monthly[index].profitLastYear || 0), 0);

          return {
            ...parent.monthly[index],
            month, actual, plan, lastYear, profitActual, profitPlan, profitLastYear
          };
        }
      });
    };

    // Aggregate Phongs to Centers
    const centers = newData.filter((d: any) => d.type === 'center');
    centers.forEach((c: any) => aggregate(c.id));
    
    // Aggregate Centers and Bans to Company
    aggregate('all');

    return newData;
  },

  seedTestData: (year: number): DepartmentData[] => {
    const data = generateInitialData(year);
    // Fill phongs with some revenue
    const phongs = data.filter(d => d.type === 'phong');
    phongs.forEach(phong => {
      phong.monthly.forEach((m, idx) => {
        if (idx < 6) { // Half year of data
          m.actual = 1000 + Math.random() * 2000;
          m.plan = 2500;
          m.lastYear = 2000;
        }
      });
    });

    // Fill bans with some revenue
    const bans = data.filter(d => d.type === 'ban');
    bans.forEach(ban => {
      ban.monthly.forEach((m, idx) => {
        if (idx < 6) {
          m.actual = 2000 + Math.random() * 3000;
          m.plan = 4000;
          m.lastYear = 3500;
        }
      });
    });

    // Fill centers with independent profit
    const centers = data.filter(d => d.type === 'center');
    centers.forEach(center => {
      center.monthly.forEach((m, idx) => {
        if (idx < 6) {
          m.netRevenueActual = 5000 + Math.random() * 2000;
          m.netRevenuePlan = 6000;
          m.expenseActual = 3000 + Math.random() * 1000;
          m.expensePlan = 3500;
          m.pbtActual = m.netRevenueActual - m.expenseActual;
          m.pbtPlan = m.netRevenuePlan - m.expensePlan;
          m.profitActual = m.pbtActual;
          m.profitPlan = m.pbtPlan;
          m.ebitdaActual = m.pbtActual + 500;
          m.ebitdaPlan = m.pbtPlan + 500;
        }
      });
    });

    // Fill company independent profit
    const company = data.find(d => d.type === 'company');
    if (company) {
      company.monthly.forEach((m, idx) => {
        if (idx < 6) {
          m.netRevenueActual = 20000 + Math.random() * 5000;
          m.netRevenuePlan = 22000;
          m.expenseActual = 12000 + Math.random() * 2000;
          m.expensePlan = 13000;
          m.pbtActual = m.netRevenueActual - m.expenseActual;
          m.pbtPlan = m.netRevenuePlan - m.expensePlan;
          m.profitActual = m.pbtActual;
          m.profitPlan = m.pbtPlan;
          m.ebitdaActual = m.pbtActual + 2000;
          m.ebitdaPlan = m.pbtPlan + 2000;
        }
      });
    }

    return dataService.recalculateTotals(data);
  },

  saveData: (data: DepartmentData[], year: number) => {
    const storageKey = `${STORAGE_PREFIX}${year}`;
    const aggregatedData = dataService.recalculateTotals(data);
    localStorage.setItem(storageKey, JSON.stringify(aggregatedData));
    return aggregatedData;
  },

  calculateCumulative: (monthly: MonthlyData[], upToMonthIndex?: number) => {
    // Determine the count of months to include in cumulative calculation
    const actualMonthsCount = upToMonthIndex !== undefined 
      ? upToMonthIndex + 1 
      : (() => {
          const reversedMonthly = [...monthly].reverse();
          // Check both actual and profitActual to find the latest month with data
          const lastActualIndexFromEnd = reversedMonthly.findIndex(m => (m.actual !== 0) || (m.profitActual !== 0));
          return lastActualIndexFromEnd === -1 ? 0 : monthly.length - lastActualIndexFromEnd;
        })();

    const cumulative = monthly.reduce(
      (acc, curr, index) => {
        const isPastOrCurrent = index < actualMonthsCount;
        return {
          actual: acc.actual + (index < actualMonthsCount ? curr.actual : 0),
          plan: acc.plan + (isPastOrCurrent ? curr.plan : 0),
          lastYear: acc.lastYear + (isPastOrCurrent ? curr.lastYear : 0),
          profitActual: acc.profitActual + (index < actualMonthsCount ? (curr.profitActual || 0) : 0),
          profitPlan: acc.profitPlan + (isPastOrCurrent ? (curr.profitPlan || 0) : 0),
          profitLastYear: acc.profitLastYear + (isPastOrCurrent ? (curr.profitLastYear || 0) : 0),
          
          netRevenueActual: acc.netRevenueActual + (index < actualMonthsCount ? (curr.netRevenueActual || 0) : 0),
          netRevenuePlan: acc.netRevenuePlan + (isPastOrCurrent ? (curr.netRevenuePlan || 0) : 0),
          netRevenueLastYear: acc.netRevenueLastYear + (isPastOrCurrent ? (curr.netRevenueLastYear || 0) : 0),
          
          expenseActual: acc.expenseActual + (index < actualMonthsCount ? (curr.expenseActual || 0) : 0),
          expensePlan: acc.expensePlan + (isPastOrCurrent ? (curr.expensePlan || 0) : 0),
          expenseLastYear: acc.expenseLastYear + (isPastOrCurrent ? (curr.expenseLastYear || 0) : 0),
          
          pbtActual: acc.pbtActual + (index < actualMonthsCount ? (curr.pbtActual || 0) : 0),
          pbtPlan: acc.pbtPlan + (isPastOrCurrent ? (curr.pbtPlan || 0) : 0),
          pbtLastYear: acc.pbtLastYear + (isPastOrCurrent ? (curr.pbtLastYear || 0) : 0),
          
          ebitdaActual: acc.ebitdaActual + (index < actualMonthsCount ? (curr.ebitdaActual || 0) : 0),
          ebitdaPlan: acc.ebitdaPlan + (isPastOrCurrent ? (curr.ebitdaPlan || 0) : 0),
          ebitdaLastYear: acc.ebitdaLastYear + (isPastOrCurrent ? (curr.ebitdaLastYear || 0) : 0),
        };
      },
      { 
        actual: 0, plan: 0, lastYear: 0, 
        profitActual: 0, profitPlan: 0, profitLastYear: 0,
        netRevenueActual: 0, netRevenuePlan: 0, netRevenueLastYear: 0,
        expenseActual: 0, expensePlan: 0, expenseLastYear: 0,
        pbtActual: 0, pbtPlan: 0, pbtLastYear: 0,
        ebitdaActual: 0, ebitdaPlan: 0, ebitdaLastYear: 0
      }
    );
    
    const annualPlan = monthly.reduce((sum, m) => sum + m.plan, 0);
    const annualProfitPlan = monthly.reduce((sum, m) => sum + (m.profitPlan || 0), 0);
    
    const annualNetRevenuePlan = monthly.reduce((sum, m) => sum + (m.netRevenuePlan || 0), 0);
    const annualExpensePlan = monthly.reduce((sum, m) => sum + (m.expensePlan || 0), 0);
    const annualPbtPlan = monthly.reduce((sum, m) => sum + (m.pbtPlan || 0), 0);
    const annualEbitdaPlan = monthly.reduce((sum, m) => sum + (m.ebitdaPlan || 0), 0);
    
    return {
      ...cumulative,
      annualPlan,
      annualProfitPlan,
      annualNetRevenuePlan,
      annualExpensePlan,
      annualPbtPlan,
      annualEbitdaPlan
    };
  },
};
