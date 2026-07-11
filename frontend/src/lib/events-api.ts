import api from "./api";
import type { EventType, MeetingVisibility } from "./event-types";

export type PrepTaskChecklistItemResponse = {
  id: number;
  label: string;
  is_completed: boolean;
  sort_order: number;
};

export type PrepTaskResponse = {
  id: number;
  group_name: string;
  due_date: string;
  assignee_id: number | null;
  is_overdue: boolean;
  is_complete: boolean;
  checklist_items: PrepTaskChecklistItemResponse[];
};

export type RsvpStatus = "going" | "maybe" | "not_going";

export type { MeetingVisibility } from "./event-types";

export type EventResponse = {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string | null;
  event_type: EventType;
  description: string;
  location: string | null;
  budget: string;
  created_by_id: number;
  current_member_rsvp_status: RsvpStatus | null;
  current_member_is_invited_participant?: boolean;
  finance_lock_at: string;
  is_finance_locked: boolean;
  is_past: boolean;
  is_finance_grace_period: boolean;
  show_in_photo_archive: boolean;
  meeting_visibility: MeetingVisibility | null;
  /** Event-specific cover photo; null/undefined falls back to category color. */
  event_photo_url?: string | null;
};

export type EventDetailResponse = EventResponse & {
  prep_tasks: PrepTaskResponse[];
  current_member_volunteer_signup: EventVolunteerSignup | null;
  current_member_feedback: EventFeedback | null;
};

export type EventFeedback = {
  id: number;
  event_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type EventFeedbackMember = {
  id: number;
  member_id: number;
  full_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type EventFeedbackListResponse = {
  feedback: EventFeedbackMember[];
  total: number;
  average_rating: number;
};

export type EventVolunteerSignup = {
  id: number;
  event_id: number;
  note: string | null;
  created_at: string;
};

export type EventVolunteerSignupMember = {
  id: number;
  member_id: number;
  full_name: string;
  note: string | null;
  created_at: string;
};

export type EventVolunteerSignupListResponse = {
  signups: EventVolunteerSignupMember[];
  total: number;
};

export type EventRsvpStatusResponse = {
  event_id: number;
  current_member_rsvp_status: RsvpStatus | null;
};

export type EventRsvpAttendee = {
  member_id: number;
  full_name: string;
  member_type: "Board member" | "General member";
  rsvp_status: RsvpStatus | null;
};

export type EventAttendeesResponse = {
  going_count: number;
  maybe_count: number;
  not_going_count: number;
  no_response_count: number;
  attendees: EventRsvpAttendee[];
};

export type EventListResponse = {
  events: EventResponse[];
  total: number;
};

export async function fetchEvents(params?: {
  month?: string;
  event_type?: EventType;
}): Promise<EventListResponse> {
  const response = await api.get<EventListResponse>("/v1/events", { params });
  return response.data;
}

export async function fetchUpcomingEvents(params?: {
  limit?: number;
}): Promise<EventListResponse> {
  const response = await api.get<EventListResponse>("/v1/events/upcoming", {
    params,
  });
  return response.data;
}

export async function fetchPastEvents(params?: {
  limit?: number;
  offset?: number;
}): Promise<EventListResponse> {
  const response = await api.get<EventListResponse>("/v1/events/past", {
    params,
  });
  return response.data;
}

export type CreateEventRequest = {
  name: string;
  starts_at: string;
  event_type: EventType;
  description: string;
  budget: string;
  meeting_visibility?: MeetingVisibility | null;
};

export async function createEvent(
  data: CreateEventRequest,
): Promise<EventResponse> {
  const response = await api.post<EventResponse>("/v1/events", data);
  return response.data;
}

export type CreatePrepTaskRequest = {
  group_name: string;
  due_date: string;
  assignee_id?: number | null;
  checklist_items?: string[];
};

export async function addPrepTaskToEvent(
  eventId: number,
  data: CreatePrepTaskRequest,
): Promise<PrepTaskResponse> {
  const response = await api.post<PrepTaskResponse>(
    `/v1/events/${eventId}/tasks`,
    data,
  );
  return response.data;
}

export async function fetchEvent(eventId: number): Promise<EventDetailResponse> {
  const response = await api.get<EventDetailResponse>(`/v1/events/${eventId}`);
  return response.data;
}

export type EventPatchRequest = {
  show_in_photo_archive?: boolean;
  starts_at?: string;
  meeting_visibility?: MeetingVisibility;
};

export async function patchEvent(
  eventId: number,
  data: EventPatchRequest,
): Promise<EventResponse> {
  const response = await api.patch<EventResponse>(`/v1/events/${eventId}`, data);
  return response.data;
}

export async function deleteEvent(eventId: number): Promise<void> {
  await api.delete(`/v1/events/${eventId}`);
}

export async function uploadEventCoverPhoto(
  eventId: number,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<EventResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<EventResponse>(
    `/v1/events/${eventId}/event-photo`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) {
          return;
        }
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    },
  );

  return response.data;
}

export async function deleteEventCoverPhoto(
  eventId: number,
): Promise<EventResponse> {
  const response = await api.delete<EventResponse>(
    `/v1/events/${eventId}/event-photo`,
  );
  return response.data;
}

export async function updateEventRsvp(
  eventId: number,
  status: RsvpStatus,
): Promise<EventRsvpStatusResponse> {
  const response = await api.put<EventRsvpStatusResponse>(
    `/v1/events/${eventId}/rsvp`,
    { status },
  );
  return response.data;
}

/** @deprecated Use updateEventRsvp(eventId, "going") */
export async function rsvpToEvent(
  eventId: number,
): Promise<EventRsvpStatusResponse> {
  const response = await api.post<EventRsvpStatusResponse>(
    `/v1/events/${eventId}/rsvp`,
  );
  return response.data;
}

/** @deprecated Prefer updateEventRsvp with a new status */
export async function cancelEventRsvp(
  eventId: number,
): Promise<EventRsvpStatusResponse> {
  const response = await api.delete<EventRsvpStatusResponse>(
    `/v1/events/${eventId}/rsvp`,
  );
  return response.data;
}

export async function fetchEventAttendees(
  eventId: number,
): Promise<EventAttendeesResponse> {
  const response = await api.get<EventAttendeesResponse>(
    `/v1/events/${eventId}/rsvps`,
  );
  return response.data;
}

export type EventParticipantInvitation = {
  id: number;
  event_id: number;
  member_id: number;
  member_name: string;
  invited_by_id: number;
  invited_by_name: string;
  created_at: string;
};

export type EventParticipantInvitationListResponse = {
  invitations: EventParticipantInvitation[];
  total: number;
};

export async function fetchEventInvitedParticipants(
  eventId: number,
): Promise<EventParticipantInvitationListResponse> {
  const response = await api.get<EventParticipantInvitationListResponse>(
    `/v1/events/${eventId}/invited-participants`,
  );
  return response.data;
}

export async function inviteEventParticipants(
  eventId: number,
  memberIds: number[],
): Promise<EventParticipantInvitationListResponse> {
  const response = await api.post<EventParticipantInvitationListResponse>(
    `/v1/events/${eventId}/invited-participants`,
    { member_ids: memberIds },
  );
  return response.data;
}

export async function removeEventInvitedParticipant(
  eventId: number,
  memberId: number,
): Promise<void> {
  await api.delete(`/v1/events/${eventId}/invited-participants/${memberId}`);
}

export async function volunteerForEvent(
  eventId: number,
  note?: string | null,
): Promise<EventVolunteerSignup> {
  const response = await api.post<EventVolunteerSignup>(
    `/v1/events/${eventId}/volunteer-signup`,
    { note: note ?? null },
  );
  return response.data;
}

export async function withdrawVolunteerSignup(eventId: number): Promise<void> {
  await api.delete(`/v1/events/${eventId}/volunteer-signup`);
}

export async function fetchEventVolunteerSignups(
  eventId: number,
): Promise<EventVolunteerSignupListResponse> {
  const response = await api.get<EventVolunteerSignupListResponse>(
    `/v1/events/${eventId}/volunteer-signups`,
  );
  return response.data;
}

export async function submitEventFeedback(
  eventId: number,
  data: { rating: number; comment?: string | null },
): Promise<EventFeedback> {
  const response = await api.post<EventFeedback>(
    `/v1/events/${eventId}/feedback`,
    data,
  );
  return response.data;
}

export async function fetchEventFeedback(
  eventId: number,
): Promise<EventFeedbackListResponse> {
  const response = await api.get<EventFeedbackListResponse>(
    `/v1/events/${eventId}/feedback`,
  );
  return response.data;
}
