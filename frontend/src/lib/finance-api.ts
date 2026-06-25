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

export type FinanceEntryResponse = {
  id: number;
  entry_type: FinanceEntryType;
  category: string;
  amount: string;
  description: string;
  receipt_url: string | null;
  event_id: number | null;
  created_by_id: number;
  created_at: string;
};

export type FinanceEntryListResponse = {
  entries: FinanceEntryResponse[];
  total: number;
};

export type FinanceEntryType = "income" | "expense";

export type CreateFinanceEntryRequest = {
  entry_type: FinanceEntryType;
  category: string;
  amount: string;
  description?: string;
  receipt_url?: string | null;
  event_id?: number | null;
};

export type ReceiptUploadResponse = {
  receipt_url: string;
  public_id: string;
  bytes: number;
  format: string | null;
  resource_type: string;
};

export async function fetchFinanceEntries(params?: {
  semester?: string;
  type?: FinanceEntryType;
  event_id?: number;
}): Promise<FinanceEntryListResponse> {
  const response = await api.get<FinanceEntryListResponse>("/v1/finance", {
    params,
  });
  return response.data;
}

export async function createFinanceEntry(
  data: CreateFinanceEntryRequest,
): Promise<FinanceEntryResponse> {
  const response = await api.post<FinanceEntryResponse>("/v1/finance", data);
  return response.data;
}

export async function uploadFinanceReceipt(
  file: File,
): Promise<ReceiptUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<ReceiptUploadResponse>(
    "/v1/finance/receipts",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return response.data;
}
