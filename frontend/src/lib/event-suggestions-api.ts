import api from "./api";
import type { EventType, MeetingVisibility } from "./event-types";

export type EventSuggestionStatus =
  | "submitted"
  | "internal_review"
  | "published"
  | "approved"
  | "rejected"
  | "converted"
  | "archived";

export type BoardUpdatableIdeaStatus = Exclude<
  EventSuggestionStatus,
  "submitted" | "converted"
>;

export type IdeaInterestVote =
  | "interested"
  | "maybe"
  | "not_interested";

export type EventSuggestionMember = {
  id: number;
  full_name: string;
  position?: string | null;
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
  board_note_updated_at?: string | null;
  board_note_updated_by?: EventSuggestionMember | null;
  can_board_review: boolean;
  converted_event_id: number | null;
  published_at: string | null;
  community_interest_enabled: boolean;
  community_discussion_enabled: boolean;
  community_visibility: IdeaCommunityVisibility;
  community_feedback_closed_at?: string | null;
  view_count: number;
  board_comment_count?: number;
  community_comment_count?: number;
  poll_count?: number;
  open_poll_count?: number;
  poll_vote_count?: number;
  eligible_member_count?: number;
  last_activity_at?: string | null;
  interest_counts: IdeaInterestCounts;
  my_interest: IdeaInterestVote | null;
};

export type IdeaCommunityVisibility =
  | "everyone"
  | "members"
  | "active_members"
  | "officers";

export type IdeaFeedbackPackagePayload = {
  attendance_interest?: boolean;
  discussion?: boolean;
  preferred_semester?: boolean;
  transportation?: boolean;
  budget?: boolean;
  volunteer_interest?: boolean;
};

export type IdeaBoardReviewPayload = {
  status?: BoardUpdatableIdeaStatus;
  board_note?: string | null;
  feedback_package?: IdeaFeedbackPackagePayload | null;
  community_visibility?: IdeaCommunityVisibility | null;
  community_feedback_closed?: boolean | null;
};

export type IdeaConvertPayload = {
  name?: string | null;
  description?: string | null;
  starts_at: string;
  event_type: EventType;
  location?: string | null;
  capacity?: number | null;
  budget?: string;
  meeting_visibility?: MeetingVisibility | null;
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
  submitted: "Submitted",
  internal_review: "Internal review",
  published: "Published",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
  archived: "Archived",
};

/** Labels framed as attendance intent for the workspace. */
export const IDEA_INTEREST_LABEL: Record<IdeaInterestVote, string> = {
  interested: "Definitely",
  maybe: "Maybe",
  not_interested: "Probably not",
};

export const IDEA_INTEREST_COUNT_LABEL: Record<IdeaInterestVote, string> = {
  interested: "would attend",
  maybe: "maybe",
  not_interested: "unlikely",
};

export const IDEA_INTEREST_OPTIONS: IdeaInterestVote[] = [
  "interested",
  "maybe",
  "not_interested",
];

/** Community RSVP while published and feedback is still open. */
export function isIdeaInterestOpen(
  status: EventSuggestionStatus,
  interestEnabled = true,
  feedbackClosed = false,
): boolean {
  return status === "published" && interestEnabled && !feedbackClosed;
}

export function isIdeaCommunityFeedbackOpen(idea: EventSuggestion): boolean {
  return (
    idea.status === "published" && idea.community_feedback_closed_at == null
  );
}

/** Members can post comments while community feedback is open. */
export function isIdeaDiscussionOpen(idea: EventSuggestion): boolean {
  return (
    idea.status === "published" &&
    idea.community_discussion_enabled !== false &&
    idea.community_feedback_closed_at == null
  );
}

/**
 * Community workspace (interest / polls).
 * Hidden during triage and internal review — even if previously published.
 */
export function isIdeaCommunityVisible(idea: EventSuggestion): boolean {
  return (
    idea.status === "published" ||
    idea.status === "approved" ||
    idea.status === "converted"
  );
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

/** Board starts private internal review. */
export async function markEventSuggestionNoted(
  suggestionId: number,
): Promise<EventSuggestion> {
  return updateEventSuggestionStatus(suggestionId, "internal_review");
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

export async function convertEventSuggestion(
  suggestionId: number,
  payload: IdeaConvertPayload,
): Promise<EventSuggestion> {
  const response = await api.post<EventSuggestion>(
    `/v1/event-suggestions/${suggestionId}/convert`,
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

export type IdeaCommunityInsightResponse = {
  response_count: number;
  insights: string[];
  source: "rules" | "ai";
  comment_count: number;
};

/** Board-only narrative synthesis of community feedback. */
export async function fetchIdeaCommunityInsight(
  suggestionId: number,
): Promise<IdeaCommunityInsightResponse> {
  const response = await api.get<IdeaCommunityInsightResponse>(
    `/v1/event-suggestions/${suggestionId}/community-insight`,
  );
  return response.data;
}
