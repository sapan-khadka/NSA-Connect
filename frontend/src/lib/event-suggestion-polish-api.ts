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

export type IdeaFeedbackPackage = {
  attendance_interest: boolean;
  discussion: boolean;
  preferred_semester: boolean;
  transportation: boolean;
  budget: boolean;
  volunteer_interest: boolean;
};

export const DEFAULT_FEEDBACK_PACKAGE: IdeaFeedbackPackage = {
  attendance_interest: true,
  discussion: true,
  preferred_semester: true,
  transportation: false,
  budget: false,
  volunteer_interest: false,
};

export const FEEDBACK_PACKAGE_OPTIONS: {
  key: keyof IdeaFeedbackPackage;
  label: string;
  hint: string;
}[] = [
  {
    key: "attendance_interest",
    label: "Attendance interest",
    hint: "Definitely / Maybe / Probably not",
  },
  {
    key: "discussion",
    label: "Community comments",
    hint: "Short qualitative feedback from members",
  },
  {
    key: "preferred_semester",
    label: "Preferred semester poll",
    hint: "Fall · Spring · Summer",
  },
  {
    key: "transportation",
    label: "Transportation poll",
    hint: "Bus · Own car · Other",
  },
  {
    key: "budget",
    label: "Budget poll",
    hint: "Free · $10 · $15 · $20",
  },
  {
    key: "volunteer_interest",
    label: "Volunteer interest poll",
    hint: "Yes · Maybe · No",
  },
];

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

export async function fetchIdeaPolls(suggestionId: number): Promise<IdeaPoll[]> {
  const response = await api.get<{ polls: IdeaPoll[] }>(
    `/v1/event-suggestions/${suggestionId}/polls`,
  );
  return response.data.polls;
}

/** @deprecated Prefer fetchIdeaPolls */
export async function fetchIdeaPoll(
  suggestionId: number,
): Promise<IdeaPoll | null> {
  const polls = await fetchIdeaPolls(suggestionId);
  return polls[0] ?? null;
}

export async function createIdeaPoll(
  suggestionId: number,
  payload: { question: string; options: string[] },
): Promise<IdeaPoll> {
  const response = await api.post<IdeaPoll>(
    `/v1/event-suggestions/${suggestionId}/polls`,
    payload,
  );
  return response.data;
}

export async function voteIdeaPoll(
  suggestionId: number,
  pollId: number,
  optionId: number,
): Promise<IdeaPoll> {
  const response = await api.put<IdeaPoll>(
    `/v1/event-suggestions/${suggestionId}/polls/${pollId}/vote`,
    { option_id: optionId },
  );
  return response.data;
}

export async function closeIdeaPoll(
  suggestionId: number,
  pollId: number,
): Promise<IdeaPoll> {
  const response = await api.post<IdeaPoll>(
    `/v1/event-suggestions/${suggestionId}/polls/${pollId}/close`,
  );
  return response.data;
}
