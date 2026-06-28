import api from "./api";
import type { EventType } from "./event-types";

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

export type EventResponse = {
  id: number;
  name: string;
  starts_at: string;
  event_type: EventType;
  description: string;
  budget: string;
  created_by_id: number;
  rsvp_count: number;
  current_member_has_rsvped: boolean;
};

export type EventDetailResponse = EventResponse & {
  prep_tasks: PrepTaskResponse[];
};

export type EventRsvpStatusResponse = {
  event_id: number;
  rsvp_count: number;
  current_member_has_rsvped: boolean;
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

export type CreateEventRequest = {
  name: string;
  starts_at: string;
  event_type: EventType;
  description: string;
  budget: string;
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

export async function rsvpToEvent(
  eventId: number,
): Promise<EventRsvpStatusResponse> {
  const response = await api.post<EventRsvpStatusResponse>(
    `/v1/events/${eventId}/rsvp`,
  );
  return response.data;
}

export async function cancelEventRsvp(
  eventId: number,
): Promise<EventRsvpStatusResponse> {
  const response = await api.delete<EventRsvpStatusResponse>(
    `/v1/events/${eventId}/rsvp`,
  );
  return response.data;
}
