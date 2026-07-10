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

export type ReceiptScanResponse = {
  readable: boolean;
  vendor: string | null;
  purchase_date: string | null;
  purchase_time: string | null;
  amount: string | null;
  description: string | null;
  category: string | null;
  confidence: string;
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

export type UpdateFinanceEntryRequest = {
  entry_type?: FinanceEntryType;
  category?: string;
  amount?: string;
  description?: string;
  receipt_url?: string | null;
  event_id?: number | null;
};

export async function updateFinanceEntry(
  entryId: number,
  data: UpdateFinanceEntryRequest,
): Promise<FinanceChangeRequestResponse> {
  const response = await api.patch<FinanceChangeRequestResponse>(
    `/v1/finance/${entryId}`,
    data,
  );
  return response.data;
}

export async function deleteFinanceEntry(
  entryId: number,
): Promise<FinanceChangeRequestResponse> {
  const response = await api.delete<FinanceChangeRequestResponse>(
    `/v1/finance/${entryId}`,
  );
  return response.data;
}

export type FinanceChangeRequestResponse = {
  id: number;
  entry_id: number;
  action: "update" | "delete";
  status: "pending" | "approved" | "rejected";
  payload: UpdateFinanceEntryRequest | null;
  requested_by_id: number;
  requested_by_name: string;
  reviewed_by_id: number | null;
  reviewed_by_name: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  entry_type: FinanceEntryType | null;
  entry_amount: string | null;
  entry_description: string | null;
};

export type FinanceChangeRequestListResponse = {
  requests: FinanceChangeRequestResponse[];
  total: number;
};

export type FinanceChangeRequestSummaryResponse = {
  pending_count: number;
  recently_rejected_count: number;
  recently_approved_count: number;
};

export type FinanceMyChangeRequestsResponse = {
  requests: FinanceChangeRequestResponse[];
  total: number;
  summary: FinanceChangeRequestSummaryResponse;
};

export async function fetchPendingFinanceChangeRequests(): Promise<FinanceChangeRequestListResponse> {
  const response = await api.get<FinanceChangeRequestListResponse>(
    "/v1/finance/change-requests/pending",
  );
  return response.data;
}

export async function fetchMyFinanceChangeRequestSummary(): Promise<FinanceChangeRequestSummaryResponse> {
  const response = await api.get<FinanceChangeRequestSummaryResponse>(
    "/v1/finance/change-requests/mine/summary",
  );
  return response.data;
}

export async function fetchMyFinanceChangeRequests(): Promise<FinanceMyChangeRequestsResponse> {
  const response = await api.get<FinanceMyChangeRequestsResponse>(
    "/v1/finance/change-requests/mine",
  );
  return response.data;
}

export async function approveFinanceChangeRequest(
  requestId: number,
): Promise<FinanceChangeRequestResponse> {
  const response = await api.post<FinanceChangeRequestResponse>(
    `/v1/finance/change-requests/${requestId}/approve`,
  );
  return response.data;
}

export async function rejectFinanceChangeRequest(
  requestId: number,
  reviewNote?: string,
): Promise<FinanceChangeRequestResponse> {
  const response = await api.post<FinanceChangeRequestResponse>(
    `/v1/finance/change-requests/${requestId}/reject`,
    { review_note: reviewNote ?? null },
  );
  return response.data;
}

export async function fetchEventBudgetForEvent(
  eventId: number,
): Promise<FinanceEventBudgetSummary> {
  const response = await api.get<FinanceEventBudgetSummary>(
    `/v1/finance/events/${eventId}/budget`,
  );
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

export async function scanFinanceReceipt(
  file: File,
): Promise<ReceiptScanResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<ReceiptScanResponse>(
    "/v1/finance/receipts/scan",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return response.data;
}
