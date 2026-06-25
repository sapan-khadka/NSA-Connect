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
};

export type EventDetailResponse = EventResponse & {
  prep_tasks: PrepTaskResponse[];
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

export async function fetchEvent(eventId: number): Promise<EventDetailResponse> {
  const response = await api.get<EventDetailResponse>(`/v1/events/${eventId}`);
  return response.data;
}
