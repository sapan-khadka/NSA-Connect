import api from "./api";

export type FinanceSummaryBucket = {
  income: string;
  expense: string;
  balance: string;
  entry_count: number;
};

export type FinanceEventSummary = {
  event_id: number;
  event_name: string;
  income: string;
  expense: string;
  balance: string;
  entry_count: number;
};

export type FinanceSummaryResponse = {
  balance: string;
  total_income: string;
  total_expense: string;
  entry_count: number;
  pre_event: FinanceSummaryBucket;
  events: FinanceEventSummary[];
};

export type FinanceEventBudgetSummary = {
  event_id: number;
  event_name: string;
  planned_budget: string;
  actual_expense: string;
  actual_income: string;
  budget_remaining: string;
  over_budget: boolean;
  entry_count: number;
};

export type FinanceEventBudgetListResponse = {
  events: FinanceEventBudgetSummary[];
  total: number;
};

export type FinanceExpenseCategorySummary = {
  category: string;
  total_expense: string;
  entry_count: number;
};

export type FinanceExpenseCategoryListResponse = {
  categories: FinanceExpenseCategorySummary[];
  total_expense: string;
};

export async function fetchFinanceSummary(params?: {
  semester?: string;
}): Promise<FinanceSummaryResponse> {
  const response = await api.get<FinanceSummaryResponse>("/v1/finance/summary", {
    params,
  });
  return response.data;
}

export async function fetchEventBudgetBreakdown(params?: {
  semester?: string;
}): Promise<FinanceEventBudgetListResponse> {
  const response = await api.get<FinanceEventBudgetListResponse>(
    "/v1/finance/event-budgets",
    { params },
  );
  return response.data;
}

export async function fetchExpenseByCategory(params?: {
  semester?: string;
}): Promise<FinanceExpenseCategoryListResponse> {
  const response = await api.get<FinanceExpenseCategoryListResponse>(
    "/v1/finance/expenses/by-category",
    { params },
  );
  return response.data;
}
