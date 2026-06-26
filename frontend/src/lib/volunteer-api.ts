import api from "./api";

export type MemberVolunteerSignup = {
  id: number;
  slot_id: number;
  task_name: string;
  event_id: number;
  event_name: string;
  event_starts_at: string;
  signed_up_at: string;
  is_done: boolean;
};

export type MemberVolunteerSignupListResponse = {
  signups: MemberVolunteerSignup[];
  total: number;
};

export async function fetchMyVolunteerSignups(): Promise<MemberVolunteerSignupListResponse> {
  const response = await api.get<MemberVolunteerSignupListResponse>(
    "/v1/me/volunteer-signups",
  );
  return response.data;
}
