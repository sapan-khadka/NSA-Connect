import api from "./api";

export type EventCheckInQrResponse = {
  event_id: number;
  event_name: string;
  checkin_url: string;
  token: string;
};

export type GuestAffiliationType = "guest_of_member" | "faculty_staff";

export type EventCheckInRecord = {
  kind: "member" | "guest";
  member_id: number | null;
  guest_id: number | null;
  full_name: string;
  email: string | null;
  affiliation_type: GuestAffiliationType | null;
  related_member_name: string | null;
  checked_in_at: string;
};

export type EventCheckInListResponse = {
  checkins: EventCheckInRecord[];
  total: number;
};

export type EventCheckInResult = {
  status: "checked_in" | "already_checked_in";
  event_id: number;
  event_name: string;
  checked_in_at: string | null;
  message: string;
};

export type EventGuestCheckInResult = {
  status: "checked_in";
  event_id: number;
  event_name: string;
  guest_name: string;
  checked_in_at: string;
  message: string;
};

export type AttendanceSummaryMember = {
  member_id: number;
  full_name: string;
  checked_in_at: string | null;
};

export type AttendanceSummaryCategory = {
  count: number;
  members: AttendanceSummaryMember[];
};

export type EventAttendanceSummary = {
  event_id: number;
  event_name: string;
  going_attended: AttendanceSummaryCategory;
  going_no_show: AttendanceSummaryCategory;
  walk_ins: AttendanceSummaryCategory;
  not_going: AttendanceSummaryCategory;
  guests_checked_in: {
    count: number;
  };
};

export async function fetchEventCheckInQr(
  eventId: number,
): Promise<EventCheckInQrResponse> {
  const response = await api.get<EventCheckInQrResponse>(
    `/v1/events/${eventId}/checkin/qr`,
  );
  return response.data;
}

export async function regenerateEventCheckInQr(
  eventId: number,
): Promise<EventCheckInQrResponse> {
  const response = await api.post<EventCheckInQrResponse>(
    `/v1/events/${eventId}/checkin/regenerate`,
  );
  return response.data;
}

export async function fetchEventCheckIns(
  eventId: number,
): Promise<EventCheckInListResponse> {
  const response = await api.get<EventCheckInListResponse>(
    `/v1/events/${eventId}/checkins`,
  );
  return response.data;
}

export async function checkInToEvent(
  eventId: number,
  token: string,
): Promise<EventCheckInResult> {
  const response = await api.post<EventCheckInResult>(
    `/v1/events/${eventId}/checkin`,
    { token },
  );
  return response.data;
}

export type GuestCheckInPayload = {
  token: string;
  guest_name: string;
  affiliation_type?: GuestAffiliationType | null;
  related_member_name?: string | null;
};

export async function checkInGuestToEvent(
  eventId: number,
  payload: GuestCheckInPayload,
): Promise<EventGuestCheckInResult> {
  const response = await api.post<EventGuestCheckInResult>(
    `/v1/events/${eventId}/checkin/guest`,
    payload,
  );
  return response.data;
}

export async function fetchEventAttendanceSummary(
  eventId: number,
): Promise<EventAttendanceSummary> {
  const response = await api.get<EventAttendanceSummary>(
    `/v1/events/${eventId}/attendance-summary`,
  );
  return response.data;
}

export function formatGuestAffiliation(
  affiliationType: GuestAffiliationType | null,
  relatedMemberName: string | null,
): string | null {
  if (affiliationType === "faculty_staff") {
    return "Faculty/Staff";
  }
  if (affiliationType === "guest_of_member") {
    return relatedMemberName
      ? `Guest of ${relatedMemberName}`
      : "Guest of a member";
  }
  return null;
}
