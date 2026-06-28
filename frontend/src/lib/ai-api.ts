import api from "./api";
import type { EventType } from "./event-types";

export type ChecklistCategory = {
  category: string;
  tasks: string[];
};

export type GenerateChecklistResponse = {
  categories: ChecklistCategory[];
};

export type GenerateChecklistRequest = {
  event_name: string;
  event_type: EventType;
  tasks?: string[];
};

export async function generateEventChecklist(
  data: GenerateChecklistRequest,
): Promise<GenerateChecklistResponse> {
  const response = await api.post<GenerateChecklistResponse>(
    "/v1/ai/generate-checklist",
    data,
  );
  return response.data;
}

export function countChecklistTasks(categories: ChecklistCategory[]): number {
  return categories.reduce((total, category) => total + category.tasks.length, 0);
}

export type MeetingActionItem = {
  task: string;
  owner: string | null;
  due: string | null;
};

export type SummarizeMinutesResponse = {
  summary: string;
  key_decisions: string[];
  action_items: MeetingActionItem[];
};

export type SummarizeMinutesRequest = {
  notes: string;
  meeting_title?: string;
};

export async function summarizeMeetingMinutes(
  data: SummarizeMinutesRequest,
): Promise<SummarizeMinutesResponse> {
  const response = await api.post<SummarizeMinutesResponse>(
    "/v1/ai/summarize-minutes",
    data,
  );
  return response.data;
}

export type DraftAnnouncementEmailResponse = {
  subject: string;
  body: string;
};

export type DraftAnnouncementEmailRequest = {
  event_name: string;
  event_type?: EventType;
  starts_at?: string;
  location?: string;
  description?: string;
};

export async function draftAnnouncementEmail(
  data: DraftAnnouncementEmailRequest,
): Promise<DraftAnnouncementEmailResponse> {
  const response = await api.post<DraftAnnouncementEmailResponse>(
    "/v1/ai/draft-announcement-email",
    data,
  );
  return response.data;
}
