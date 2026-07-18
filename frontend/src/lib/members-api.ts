import api from "./api";
import type { MemberResponse, TokenResponse } from "./auth-api";
import type { MemberActivityListResponse } from "./member-activity-timeline";
import type { MemberTalent, ProfileFieldVisibility } from "./member-talents";
import type { MemberPosition } from "./roles";

export type PendingMembersResponse = {
  members: MemberResponse[];
  total: number;
};

export type PaginatedMembersResponse = {
  members: MemberResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type FetchMembersParams = {
  page?: number;
  page_size?: number;
  status?: string;
  talents?: string[];
};

export type TalentOptionsResponse = {
  talents: string[];
  labels: Record<string, string>;
};

export async function fetchTalentOptions(): Promise<TalentOptionsResponse> {
  const response = await api.get<TalentOptionsResponse>("/v1/members/talent-options");
  return response.data;
}

function serializeMembersQueryParams(params: FetchMembersParams): string {
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) {
    searchParams.append("page", String(params.page));
  }
  if (params.page_size !== undefined) {
    searchParams.append("page_size", String(params.page_size));
  }
  if (params.status) {
    searchParams.append("status", params.status);
  }
  if (params.talents?.length) {
    for (const talent of params.talents) {
      searchParams.append("talents", talent);
    }
  }

  return searchParams.toString();
}

export async function fetchMembers(
  params: FetchMembersParams = {},
): Promise<PaginatedMembersResponse> {
  const query = serializeMembersQueryParams(params);
  const response = await api.get<PaginatedMembersResponse>(
    query ? `/v1/members?${query}` : "/v1/members",
  );
  return response.data;
}

export async function fetchMemberById(memberId: number): Promise<MemberResponse> {
  const response = await api.get<MemberResponse>(`/v1/members/${memberId}`);
  return response.data;
}

export async function fetchMemberActivity(
  memberId: number,
  params?: { limit?: number },
): Promise<MemberActivityListResponse> {
  const response = await api.get<MemberActivityListResponse>(
    `/v1/members/${memberId}/activity`,
    { params },
  );
  return response.data;
}

export type MemberMeetingAttendanceStreakResponse = {
  member_id: number;
  consecutive_missed_meetings: number;
};

/** Trailing consecutive ABSENT meeting roll-call marks for insights. */
export async function fetchMemberMeetingAttendanceStreak(
  memberId: number,
): Promise<MemberMeetingAttendanceStreakResponse> {
  const response = await api.get<MemberMeetingAttendanceStreakResponse>(
    `/v1/members/${memberId}/meeting-attendance-streak`,
  );
  return response.data;
}

export async function fetchPendingMembers(): Promise<PendingMembersResponse> {
  const response = await api.get<PendingMembersResponse>("/v1/members/pending");
  return response.data;
}

export type AssignableMembersScope = "board" | "all_approved";

export async function fetchAssignableMembers(
  scope: AssignableMembersScope = "board",
): Promise<PendingMembersResponse> {
  const response = await api.get<PendingMembersResponse>("/v1/members/assignees", {
    params: { scope },
  });
  return response.data;
}

function filenameFromContentDisposition(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  return plainMatch?.[1] ?? null;
}

/** Board-only CSV download of all members (blob + anchor click). */
export async function downloadMembersCsv(): Promise<void> {
  const response = await api.get<Blob>("/v1/members/export", {
    responseType: "blob",
  });
  const filename =
    filenameFromContentDisposition(
      response.headers["content-disposition"] as string | undefined,
    ) ?? "nsa-members.csv";
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type MemberImportSkippedRow = {
  row_number: number;
  email: string | null;
  reason: string;
};

export type MemberImportResponse = {
  rows_created: number;
  rows_skipped: number;
  skipped_rows: MemberImportSkippedRow[];
};

/** Board-only CSV import of invited members (multipart file upload). */
export async function importMembersCsv(
  file: File,
): Promise<MemberImportResponse> {
  const form = new FormData();
  form.append("file", file);
  const response = await api.post<MemberImportResponse>(
    "/v1/members/import",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

export type InviteMemberRequest = {
  full_name: string;
  email: string;
  student_id: string;
  major: string;
  graduation_year: number;
  phone?: string | null;
};

export type InviteMemberResponse = {
  member: MemberResponse;
  setup_email_sent: boolean;
};

export async function inviteMember(
  data: InviteMemberRequest,
): Promise<InviteMemberResponse> {
  const response = await api.post<InviteMemberResponse>(
    "/v1/members/invite",
    data,
  );
  return response.data;
}

export async function approveMember(memberId: number): Promise<MemberResponse> {
  const response = await api.patch<MemberResponse>(
    `/v1/members/${memberId}/approve`,
  );
  return response.data;
}

export async function rejectMember(memberId: number): Promise<MemberResponse> {
  const response = await api.patch<MemberResponse>(
    `/v1/members/${memberId}/reject`,
  );
  return response.data;
}

export type UpdateProfileRequest = {
  full_name?: string;
  email?: string;
  major?: string;
  graduation_year?: number;
  interests?: string | null;
  bio?: string | null;
  talents?: MemberTalent[] | string[];
  talent_other?: string | null;
  phone?: string | null;
  social_handle?: string | null;
  email_visibility?: ProfileFieldVisibility;
  phone_visibility?: ProfileFieldVisibility;
  social_handle_visibility?: ProfileFieldVisibility;
};

export async function fetchMyProfile(): Promise<MemberResponse> {
  const response = await api.get<MemberResponse>("/v1/members/me");
  return response.data;
}

export async function updateMyProfile(
  data: UpdateProfileRequest,
): Promise<MemberResponse> {
  const response = await api.patch<MemberResponse>("/v1/members/me", data);
  return response.data;
}

export async function updateMemberProfile(
  memberId: number,
  data: UpdateProfileRequest,
): Promise<MemberResponse> {
  const response = await api.patch<MemberResponse>(`/v1/members/${memberId}`, data);
  return response.data;
}

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

export async function changeMyPassword(
  data: ChangePasswordRequest,
): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>("/v1/members/me/password", data);
  return response.data;
}

export type UpdateMemberRoleRequest = {
  role: "general" | "board";
};

export async function updateMemberRole(
  memberId: number,
  data: UpdateMemberRoleRequest,
): Promise<MemberResponse> {
  const response = await api.patch<MemberResponse>(
    `/v1/members/${memberId}/role`,
    data,
  );
  return response.data;
}

export async function updateMemberPosition(
  memberId: number,
  position: MemberPosition,
): Promise<MemberResponse> {
  const response = await api.patch<MemberResponse>(
    `/v1/members/${memberId}/position`,
    { position },
  );
  return response.data;
}
