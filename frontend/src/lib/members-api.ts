import api from "./api";
import type { MemberResponse } from "./auth-api";
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
};

export async function fetchMembers(
  params: FetchMembersParams = {},
): Promise<PaginatedMembersResponse> {
  const response = await api.get<PaginatedMembersResponse>("/v1/members", {
    params,
  });
  return response.data;
}

export async function fetchMemberById(memberId: number): Promise<MemberResponse> {
  const response = await api.get<MemberResponse>(`/v1/members/${memberId}`);
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

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

export async function changeMyPassword(data: ChangePasswordRequest): Promise<void> {
  await api.post("/v1/members/me/password", data);
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
