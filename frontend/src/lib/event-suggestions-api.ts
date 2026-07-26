import api from "./api";

export type EventSuggestionStatus =
  | "pending_review"
  | "under_discussion"
  | "approved"
  | "rejected"
  | "converted"
  | "archived";

export type BoardUpdatableIdeaStatus = Exclude<
  EventSuggestionStatus,
  "pending_review" | "converted"
>;

export type IdeaInterestVote =
  | "interested"
  | "maybe"
  | "not_interested";

export type EventSuggestionMember = {
  id: number;
  full_name: string;
};

export type IdeaInterestCounts = {
  interested: number;
  maybe: number;
  not_interested: number;
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
  board_note: string | null;
  can_board_review: boolean;
  interest_counts: IdeaInterestCounts;
  my_interest: IdeaInterestVote | null;
};

export type IdeaBoardReviewPayload = {
  status?: BoardUpdatableIdeaStatus;
  board_note?: string | null;
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

export const IDEA_STATUS_LABEL: Record<EventSuggestionStatus, string> = {
  pending_review: "Pending review",
  under_discussion: "Under discussion",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
  archived: "Archived",
};

export const IDEA_INTEREST_LABEL: Record<IdeaInterestVote, string> = {
  interested: "Interested",
  maybe: "Maybe",
  not_interested: "Not interested",
};

export const IDEA_INTEREST_OPTIONS: IdeaInterestVote[] = [
  "interested",
  "maybe",
  "not_interested",
];

export function isIdeaInterestOpen(status: EventSuggestionStatus): boolean {
  return (
    status === "pending_review" ||
    status === "under_discussion" ||
    status === "approved"
  );
}

/** Discussion follows the same open window as interest voting. */
export function isIdeaDiscussionOpen(status: EventSuggestionStatus): boolean {
  return isIdeaInterestOpen(status);
}

export function totalIdeaInterest(counts: IdeaInterestCounts): number {
  return counts.interested + counts.maybe + counts.not_interested;
}

export async function fetchEventSuggestions(): Promise<EventSuggestionListResponse> {
  const response = await api.get<EventSuggestionListResponse>(
    "/v1/event-suggestions",
  );
  return response.data;
}

export async function fetchEventSuggestion(
  suggestionId: number,
): Promise<EventSuggestion> {
  const response = await api.get<EventSuggestion>(
    `/v1/event-suggestions/${suggestionId}`,
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

export async function updateEventSuggestionStatus(
  suggestionId: number,
  status: BoardUpdatableIdeaStatus,
): Promise<EventSuggestion> {
  const response = await api.patch<EventSuggestion>(
    `/v1/event-suggestions/${suggestionId}/status`,
    { status },
  );
  return response.data;
}

/** Board review opens the idea for discussion. */
export async function markEventSuggestionNoted(
  suggestionId: number,
): Promise<EventSuggestion> {
  return updateEventSuggestionStatus(suggestionId, "under_discussion");
}

export async function reviewEventSuggestion(
  suggestionId: number,
  payload: IdeaBoardReviewPayload,
): Promise<EventSuggestion> {
  const response = await api.patch<EventSuggestion>(
    `/v1/event-suggestions/${suggestionId}/review`,
    payload,
  );
  return response.data;
}

export async function setEventSuggestionInterest(
  suggestionId: number,
  vote: IdeaInterestVote,
): Promise<EventSuggestion> {
  const response = await api.put<EventSuggestion>(
    `/v1/event-suggestions/${suggestionId}/interest`,
    { vote },
  );
  return response.data;
}

export async function clearEventSuggestionInterest(
  suggestionId: number,
): Promise<EventSuggestion> {
  const response = await api.delete<EventSuggestion>(
    `/v1/event-suggestions/${suggestionId}/interest`,
  );
  return response.data;
}
