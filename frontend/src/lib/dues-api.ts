import api from "./api";

export type DuesStatus = "paid" | "unpaid" | "partial" | "exempt";

export type DuesPaymentMethod = "venmo" | "cash" | "other" | "online";

export type SemesterDuesSettingsResponse = {
  semester: string;
  default_amount: string;
};

export type DuesDashboardSummary = {
  semester: string;
  default_amount: string | null;
  total_expected: string;
  total_collected: string;
  total_outstanding: string;
  paid_count: number;
  unpaid_count: number;
  partial_count: number;
  exempt_count: number;
  member_count: number;
};

export type MemberDuesRecord = {
  id: number;
  member_id: number;
  member_name: string;
  member_email: string;
  semester: string;
  amount_owed: string;
  amount_paid: string;
  status: DuesStatus;
  paid_at: string | null;
  payment_method: DuesPaymentMethod | null;
  note: string | null;
  finance_entry_id: number | null;
};

export type DuesDashboardResponse = {
  summary: DuesDashboardSummary;
  records: MemberDuesRecord[];
};

export type GenerateDuesResponse = {
  semester: string;
  created_count: number;
  skipped_count: number;
  default_amount: string;
};

export type MyDuesStatusResponse = {
  semester: string;
  amount_owed: string | null;
  amount_paid: string | null;
  status: DuesStatus | null;
  has_record: boolean;
  paid_at?: string | null;
};

export type MemberDuesHistoryItem = {
  id: number;
  member_id: number;
  semester: string;
  amount_owed: string;
  amount_paid: string;
  status: DuesStatus;
  paid_at: string | null;
};

export type MemberDuesHistoryResponse = {
  member_id: number;
  records: MemberDuesHistoryItem[];
  total: number;
};

export type FetchDuesDashboardParams = {
  semester: string;
  status?: DuesStatus;
  search?: string;
};

export async function fetchDuesDashboard(
  params: FetchDuesDashboardParams,
): Promise<DuesDashboardResponse> {
  const response = await api.get<DuesDashboardResponse>("/v1/finance/dues", { params });
  return response.data;
}

export async function fetchSemesterDuesSettings(
  semester: string,
): Promise<SemesterDuesSettingsResponse | null> {
  try {
    const response = await api.get<SemesterDuesSettingsResponse>(
      "/v1/finance/dues/settings",
      { params: { semester } },
    );
    return response.data;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return null;
    }
    throw error;
  }
}

export async function upsertSemesterDuesSettings(payload: {
  semester: string;
  default_amount: string;
}): Promise<SemesterDuesSettingsResponse> {
  const response = await api.put<SemesterDuesSettingsResponse>(
    "/v1/finance/dues/settings",
    payload,
  );
  return response.data;
}

export async function generateDuesRecords(
  semester: string,
): Promise<GenerateDuesResponse> {
  const response = await api.post<GenerateDuesResponse>("/v1/finance/dues/generate", {
    semester,
  });
  return response.data;
}

export async function markDuesPaid(
  duesId: number,
  payload: {
    payment_method: DuesPaymentMethod;
    paid_at?: string;
    amount_paid?: string;
    note?: string;
  },
): Promise<MemberDuesRecord> {
  const response = await api.post<MemberDuesRecord>(
    `/v1/finance/dues/${duesId}/mark-paid`,
    payload,
  );
  return response.data;
}

export async function markDuesUnpaid(duesId: number): Promise<MemberDuesRecord> {
  const response = await api.post<MemberDuesRecord>(
    `/v1/finance/dues/${duesId}/mark-unpaid`,
  );
  return response.data;
}

export async function updateMemberDues(
  duesId: number,
  payload: {
    amount_owed?: string;
    amount_paid?: string;
    payment_method?: DuesPaymentMethod;
    note?: string;
  },
): Promise<MemberDuesRecord> {
  const response = await api.patch<MemberDuesRecord>(
    `/v1/finance/dues/${duesId}`,
    payload,
  );
  return response.data;
}

export async function fetchMyDuesStatus(
  semester: string,
): Promise<MyDuesStatusResponse> {
  const response = await api.get<MyDuesStatusResponse>("/v1/finance/dues/mine", {
    params: { semester },
  });
  return response.data;
}

export async function fetchMyDuesHistory(): Promise<MemberDuesHistoryResponse> {
  const response = await api.get<MemberDuesHistoryResponse>(
    "/v1/finance/dues/mine/history",
  );
  return response.data;
}

/** Treasury / privileged — all semester rows for another member. */
export async function fetchMemberDuesHistory(
  memberId: number,
): Promise<MemberDuesHistoryResponse> {
  const response = await api.get<MemberDuesHistoryResponse>(
    "/v1/finance/dues/history",
    { params: { member_id: memberId } },
  );
  return response.data;
}
