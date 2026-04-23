
export interface MonthlyData {
  month: string;
  actual: number;
  plan: number;
  lastYear: number;
  profitActual?: number;
  profitPlan?: number;
  profitLastYear?: number;

  // Detailed Profit indicators
  netRevenueActual?: number;
  netRevenuePlan?: number;
  netRevenueLastYear?: number;
  
  expenseActual?: number;
  expensePlan?: number;
  expenseLastYear?: number;

  pbtActual?: number;
  pbtPlan?: number;
  pbtLastYear?: number;

  ebitdaActual?: number;
  ebitdaPlan?: number;
  ebitdaLastYear?: number;
}

export interface DepartmentData {
  id: string;
  name: string;
  parentId?: string;
  type: 'company' | 'center' | 'ban' | 'phong' | 'product';
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
