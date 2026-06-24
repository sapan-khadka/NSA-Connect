import api from "./api";
import type { MemberResponse } from "./auth-api";

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

export async function fetchPendingMembers(): Promise<PendingMembersResponse> {
  const response = await api.get<PendingMembersResponse>("/v1/members/pending");
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
