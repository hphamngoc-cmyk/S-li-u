
export interface MonthlyData {
  month: string;
  actual: number;
  plan: number;
  lastYear: number;
  profitActual?: number;
  profitPlan?: number;
  profitLastYear?: number;
}

export interface DepartmentData {
  id: string;
  name: string;
  parentId?: string;
  type: 'company' | 'center' | 'ban' | 'phong';
  monthly: MonthlyData[];
}

export interface DashboardStats {
  actual: number;
  plan: number;
  lastYear: number;
  performanceVsPlan: number;
  performanceVsLastYear: number;
  cumulativeActual: number;
  cumulativePlan: number;
  cumulativeLastYear: number;
}
