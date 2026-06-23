import api from "./api";
import type { MemberResponse } from "./auth-api";

export type PendingMembersResponse = {
  members: MemberResponse[];
  total: number;
};

export async function fetchPendingMembers(): Promise<PendingMembersResponse> {
  const response = await api.get<PendingMembersResponse>("/v1/members/pending");
  return response.data;
}
