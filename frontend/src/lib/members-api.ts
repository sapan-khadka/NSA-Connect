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

export async function fetchPendingMembers(): Promise<PendingMembersResponse> {
  const response = await api.get<PendingMembersResponse>("/v1/members/pending");
  return response.data;
}

export async function fetchAssignableMembers(): Promise<PendingMembersResponse> {
  const response = await api.get<PendingMembersResponse>("/v1/members/assignees");
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
