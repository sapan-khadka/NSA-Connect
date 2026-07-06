import api from "./api";

export type EventSuggestionStatus = "submitted" | "noted";

export type EventSuggestionMember = {
  id: number;
  full_name: string;
};

export type EventSuggestion = {
  id: number;
  title: string;
  description: string;
  preferred_timing: string | null;
  status: EventSuggestionStatus;
  suggested_by: EventSuggestionMember;
  noted_by: EventSuggestionMember | null;
  created_at: string;
  noted_at: string | null;
};

export type EventSuggestionListResponse = {
  suggestions: EventSuggestion[];
  total: number;
};

export type EventSuggestionCreatePayload = {
  title: string;
  description: string;
  preferred_timing?: string | null;
};

export async function fetchEventSuggestions(): Promise<EventSuggestionListResponse> {
  const response = await api.get<EventSuggestionListResponse>(
    "/v1/event-suggestions",
  );
  return response.data;
}

export async function createEventSuggestion(
  payload: EventSuggestionCreatePayload,
): Promise<EventSuggestion> {
  const response = await api.post<EventSuggestion>(
    "/v1/event-suggestions",
    payload,
  );
  return response.data;
}

export async function markEventSuggestionNoted(
  suggestionId: number,
): Promise<EventSuggestion> {
  const response = await api.patch<EventSuggestion>(
    `/v1/event-suggestions/${suggestionId}/status`,
    { status: "noted" },
  );
  return response.data;
}
