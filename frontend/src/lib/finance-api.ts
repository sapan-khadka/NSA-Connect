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

export async function fetchFinanceSummary(params?: {
  semester?: string;
}): Promise<FinanceSummaryResponse> {
  const response = await api.get<FinanceSummaryResponse>("/v1/finance/summary", {
    params,
  });
  return response.data;
}
