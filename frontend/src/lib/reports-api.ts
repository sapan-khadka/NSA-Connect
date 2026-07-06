import api from "./api";

export type ReportRangeType = "semester" | "custom";

export type ReportGenerateRequest =
  | {
      range_type: "semester";
      semester: string;
    }
  | {
      range_type: "custom";
      period_start: string;
      period_end: string;
    };

export type ReportEventSummary = {
  id: number;
  name: string;
  starts_at: string;
  event_type: string;
  attendance_count: number;
  member_checkins: number;
  guest_checkins: number;
  rsvp_going_attended: number;
  rsvp_going_no_show: number;
  walk_ins: number;
};

export type ReportEventsSection = {
  total_events: number;
  events: ReportEventSummary[];
};

export type ReportAttendanceSection = {
  total_member_checkins: number;
  total_guest_checkins: number;
  total_checkins: number;
  events_with_checkins: number;
};

export type ReportFinanceSection = {
  total_income: string;
  total_expense: string;
  net_balance: string;
  entry_count: number;
};

export type ReportDuesSection = {
  semesters: string[];
  total_expected: string;
  total_collected: string;
  total_outstanding: string;
  paid_count: number;
  unpaid_count: number;
  partial_count: number;
  exempt_count: number;
  member_count: number;
};

export type ReportFeedbackSection = {
  response_count: number;
  average_rating: number | null;
  events_with_feedback: number;
};

export type ReportMembershipSection = {
  total_approved: number;
  board_plus_count: number;
  general_count: number;
};

export type ReportData = {
  title: string;
  period_label: string;
  range_type: ReportRangeType;
  semester: string | null;
  period_start: string;
  period_end: string;
  generated_at: string;
  events: ReportEventsSection;
  attendance: ReportAttendanceSection;
  finance: ReportFinanceSection;
  dues: ReportDuesSection;
  feedback: ReportFeedbackSection;
  membership: ReportMembershipSection;
};

export type ReportListItem = {
  id: number;
  title: string;
  range_type: ReportRangeType;
  semester: string | null;
  period_start: string;
  period_end: string;
  period_label: string;
  generated_by_name: string;
  created_at: string;
};

export type ReportListResponse = {
  reports: ReportListItem[];
  total: number;
};

export type ReportDetailResponse = {
  id: number;
  title: string;
  range_type: ReportRangeType;
  semester: string | null;
  period_start: string;
  period_end: string;
  generated_by_name: string;
  created_at: string;
  data: ReportData;
};

export async function fetchReports(): Promise<ReportListResponse> {
  const response = await api.get<ReportListResponse>("/v1/reports");
  return response.data;
}

export async function generateReport(
  payload: ReportGenerateRequest,
): Promise<ReportDetailResponse> {
  const response = await api.post<ReportDetailResponse>("/v1/reports", payload);
  return response.data;
}

export async function fetchReport(reportId: number): Promise<ReportDetailResponse> {
  const response = await api.get<ReportDetailResponse>(`/v1/reports/${reportId}`);
  return response.data;
}

export function reportPdfUrl(reportId: number): string {
  return `/api/v1/reports/${reportId}/pdf`;
}

export async function downloadReportPdf(
  reportId: number,
): Promise<{ blob: Blob; filename: string }> {
  const response = await api.get(`/v1/reports/${reportId}/pdf`, {
    responseType: "blob",
  });
  const disposition = response.headers["content-disposition"] as string | undefined;
  const filenameMatch = disposition?.match(/filename="([^"]+)"/);
  return {
    blob: response.data,
    filename: filenameMatch?.[1] ?? `nsa-connect-report-${reportId}.pdf`,
  };
}
