import api from "./api";

import type {
  EventSuggestionMember,
  EventSuggestionStatus,
} from "./event-suggestions-api";

export type IdeaActivityItem = {
  kind: string;
  summary: string;
  created_at: string;
  actor: EventSuggestionMember | null;
};

export type IdeaRelatedItem = {
  id: number;
  title: string;
  status: EventSuggestionStatus;
  preferred_timing: string | null;
  interested_count: number;
  suggested_by: EventSuggestionMember;
};

export type IdeaPollOption = {
  id: number;
  label: string;
  sort_order: number;
  vote_count: number;
};

export type IdeaPoll = {
  id: number;
  suggestion_id: number;
  question: string;
  is_open: boolean;
  created_at: string;
  created_by: EventSuggestionMember;
  my_option_id: number | null;
  total_votes: number;
  options: IdeaPollOption[];
};

export async function fetchIdeaActivity(
  suggestionId: number,
): Promise<IdeaActivityItem[]> {
  const response = await api.get<{ items: IdeaActivityItem[] }>(
    `/v1/event-suggestions/${suggestionId}/activity`,
  );
  return response.data.items;
}

export async function fetchRelatedIdeas(
  suggestionId: number,
): Promise<IdeaRelatedItem[]> {
  const response = await api.get<{ ideas: IdeaRelatedItem[] }>(
    `/v1/event-suggestions/${suggestionId}/related`,
  );
  return response.data.ideas;
}

export async function fetchIdeaPoll(
  suggestionId: number,
): Promise<IdeaPoll | null> {
  const response = await api.get<{ poll: IdeaPoll | null }>(
    `/v1/event-suggestions/${suggestionId}/poll`,
  );
  return response.data.poll;
}

export async function createIdeaPoll(
  suggestionId: number,
  payload: { question: string; options: string[] },
): Promise<IdeaPoll> {
  const response = await api.post<IdeaPoll>(
    `/v1/event-suggestions/${suggestionId}/poll`,
    payload,
  );
  return response.data;
}

export async function voteIdeaPoll(
  suggestionId: number,
  optionId: number,
): Promise<IdeaPoll> {
  const response = await api.put<IdeaPoll>(
    `/v1/event-suggestions/${suggestionId}/poll/vote`,
    { option_id: optionId },
  );
  return response.data;
}

export async function closeIdeaPoll(suggestionId: number): Promise<IdeaPoll> {
  const response = await api.post<IdeaPoll>(
    `/v1/event-suggestions/${suggestionId}/poll/close`,
  );
  return response.data;
}
