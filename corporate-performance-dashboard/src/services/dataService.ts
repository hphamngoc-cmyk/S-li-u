import { DepartmentData, MonthlyData } from '../types';

const STORAGE_KEY = 'corporate_dashboard_data';

const initialMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const generateInitialData = (): DepartmentData[] => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const createMonthly = (base: number, perf: number) => months.map((month, index) => {
    const plan = base + index * 10;
    const lastYear = Math.floor(plan * 0.9);
    const actual = index <= 2 ? Math.floor(plan * perf) : 0;
    return { month, actual, plan, lastYear };
  });

  const rawData: any[] = [
    { id: 'all', name: 'CÔNG TY', type: 'company' },
    // Centers
    { id: 'tmc', name: 'TMC', type: 'center', parentId: 'all' },
    { id: 'nura_hn', name: 'NURA HN', type: 'center', parentId: 'all' },
    { id: 'nura_hcm', name: 'NURA HCM', type: 'center', parentId: 'all' },
    // Bans (Directly under Company)
    { id: 'telesales', name: 'TELESALES', type: 'ban', parentId: 'all', base: 500, perf: 1.1 },
    { id: 'hunt1', name: 'HUNT1', type: 'ban', parentId: 'all', base: 400, perf: 0.9 },
    { id: 'hunt2', name: 'HUNT2', type: 'ban', parentId: 'all', base: 300, perf: 0.85 },
    { id: 'partnership', name: 'PARTNERSHIP', type: 'ban', parentId: 'all', base: 200, perf: 1.05 },
    { id: 'farm', name: 'FARM', type: 'ban', parentId: 'all', base: 150, perf: 0.95 },
    { id: 'nha_thuoc', name: 'NHÀ THUỐC', type: 'ban', parentId: 'all', base: 100, perf: 0.8 },
    // Phongs under TMC
    { id: 'tmc_telesales', name: 'TELESALES', type: 'phong', parentId: 'tmc', base: 150, perf: 1.15 },
    { id: 'tmc_hunt1', name: 'HUNT1', type: 'phong', parentId: 'tmc', base: 120, perf: 0.92 },
    { id: 'tmc_hunt2', name: 'HUNT2', type: 'phong', parentId: 'tmc', base: 100, perf: 0.88 },
    { id: 'tmc_partnership', name: 'PARTNERSHIP', type: 'phong', parentId: 'tmc', base: 80, perf: 1.08 },
    { id: 'tmc_farm', name: 'FARM', type: 'phong', parentId: 'tmc', base: 50, perf: 0.98 },
    // Phongs under NURA HN
    { id: 'nura_hn_telesales', name: 'TELESALES', type: 'phong', parentId: 'nura_hn', base: 140, perf: 1.12 },
    { id: 'nura_hn_hunt1', name: 'HUNT1', type: 'phong', parentId: 'nura_hn', base: 110, perf: 0.9 },
    { id: 'nura_hn_hunt2', name: 'HUNT2', type: 'phong', parentId: 'nura_hn', base: 90, perf: 0.86 },
    { id: 'nura_hn_partnership', name: 'PARTNERSHIP', type: 'phong', parentId: 'nura_hn', base: 70, perf: 1.04 },
    { id: 'nura_hn_farm', name: 'FARM', type: 'phong', parentId: 'nura_hn', base: 40, perf: 0.94 },
    // Phongs under NURA HCM
    { id: 'nura_hcm_telesales', name: 'TELESALES', type: 'phong', parentId: 'nura_hcm', base: 130, perf: 1.1 },
    { id: 'nura_hcm_hunt1', name: 'HUNT1', type: 'phong', parentId: 'nura_hcm', base: 100, perf: 0.88 },
    { id: 'nura_hcm_hunt2', name: 'HUNT2', type: 'phong', parentId: 'nura_hcm', base: 80, perf: 0.84 },
    { id: 'nura_hcm_partnership', name: 'PARTNERSHIP', type: 'phong', parentId: 'nura_hcm', base: 60, perf: 1.02 },
    { id: 'nura_hcm_farm', name: 'FARM', type: 'phong', parentId: 'nura_hcm', base: 30, perf: 0.92 },
  ];

  const result: DepartmentData[] = rawData.map(d => ({
    id: d.id,
    name: d.name,
    type: d.type,
    parentId: d.parentId,
    monthly: d.base ? createMonthly(d.base, d.perf) : months.map(m => ({ month: m, actual: 0, plan: 0, lastYear: 0 }))
  }));

  // Aggregate data from children to parents
  const aggregate = (parentId: string) => {
    let children = result.filter(d => d.parentId === parentId);
    
    // If aggregating for Company, only include 'ban' types
    if (parentId === 'all') {
      children = children.filter(d => d.type === 'ban');
    }

    const parent = result.find(d => d.id === parentId);
    if (!parent) return;

    parent.monthly = months.map((month, index) => {
      const actual = children.reduce((sum, c) => sum + c.monthly[index].actual, 0);
      const plan = children.reduce((sum, c) => sum + c.monthly[index].plan, 0);
      const lastYear = children.reduce((sum, c) => sum + c.monthly[index].lastYear, 0);
      return { month, actual, plan, lastYear };
    });
  };

  // Aggregate Phongs to Centers
  aggregate('tmc');
  aggregate('nura_hn');
  aggregate('nura_hcm');
  // Aggregate Centers and Bans to Company
  aggregate('all');

  return result;
};

export const dataService = {
  getData: (): DepartmentData[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsedData = JSON.parse(stored);
        // Ensure the latest aggregation rules are applied to existing data 
        // without losing the user's manual entries for leaf nodes.
        return dataService.recalculateTotals(parsedData);
      } catch (e) {
        console.error('Failed to parse stored data', e);
      }
    }
    
    // Only generate initial data if nothing is stored
    const initial = generateInitialData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  },

  recalculateTotals: (data: DepartmentData[]): DepartmentData[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const newData = JSON.parse(JSON.stringify(data));

    const aggregate = (parentId: string) => {
      let children = newData.filter((d: any) => d.parentId === parentId);
      
      // If aggregating for Company, only include 'ban' types
      if (parentId === 'all') {
        children = children.filter((d: any) => d.type === 'ban');
      }

      const parent = newData.find((d: any) => d.id === parentId);
      if (!parent) return;

      parent.monthly = months.map((month, index) => {
        const actual = children.reduce((sum: number, c: any) => sum + c.monthly[index].actual, 0);
        const plan = children.reduce((sum: number, c: any) => sum + c.monthly[index].plan, 0);
        const lastYear = children.reduce((sum: number, c: any) => sum + c.monthly[index].lastYear, 0);
        return { month, actual, plan, lastYear };
      });
    };

    // Aggregate Phongs to Centers
    const centers = newData.filter((d: any) => d.type === 'center');
    centers.forEach((c: any) => aggregate(c.id));
    
    // Aggregate Centers and Bans to Company
    aggregate('all');

    return newData;
  },

  saveData: (data: DepartmentData[]) => {
    const aggregatedData = dataService.recalculateTotals(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(aggregatedData));
    return aggregatedData;
  },

  calculateCumulative: (monthly: MonthlyData[], upToMonthIndex?: number) => {
    // Determine the count of months to include in cumulative calculation
    const actualMonthsCount = upToMonthIndex !== undefined 
      ? upToMonthIndex + 1 
      : (() => {
          const reversedMonthly = [...monthly].reverse();
          const lastActualIndexFromEnd = reversedMonthly.findIndex(m => m.actual > 0);
          return lastActualIndexFromEnd === -1 ? 0 : monthly.length - lastActualIndexFromEnd;
        })();

    const cumulative = monthly.reduce(
      (acc, curr, index) => {
        const isPastOrCurrent = index < actualMonthsCount;
        return {
          actual: acc.actual + (index < actualMonthsCount ? curr.actual : 0),
          plan: acc.plan + (isPastOrCurrent ? curr.plan : 0),
          lastYear: acc.lastYear + (isPastOrCurrent ? curr.lastYear : 0),
        };
      },
      { actual: 0, plan: 0, lastYear: 0 }
    );
    
    const annualPlan = monthly.reduce((sum, m) => sum + m.plan, 0);
    
    return {
      ...cumulative,
      annualPlan
    };
  },
};
