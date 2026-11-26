import api from "./api";
import type { MeetingActionItem } from "./ai-api";

export type MeetingAttendanceStatus = "present" | "absent" | "excused";

export type MeetingAttendanceEntry = {
  member_id: number;
  full_name: string;
  position: string;
  role: string;
  status: MeetingAttendanceStatus | null;
};

export type MeetingMinutes = {
  raw_notes: string;
  summary: string | null;
  key_decisions: string[];
  action_items: MeetingActionItem[];
  updated_at: string | null;
  updated_by_name: string | null;
  published_at?: string | null;
  draft_summary?: string | null;
  draft_key_decisions?: string[];
  draft_action_items?: MeetingActionItem[];
  draft_updated_at?: string | null;
  draft_updated_by_name?: string | null;
  draft_version?: number | null;
};

export type MeetingDraftUpdate = {
  summary: string;
  key_decisions: string[];
  action_items: MeetingActionItem[];
  base_draft_version: number | null;
};

export type MeetingDetailResponse = {
  event_id: number;
  event_name: string;
  agenda: string;
  starts_at: string;
  is_past: boolean;
  can_manage: boolean;
  minutes: MeetingMinutes;
  attendance: MeetingAttendanceEntry[];
  present_count: number;
  absent_count: number;
  excused_count: number;
  unmarked_count: number;
};

export type MeetingSummary = {
  event_id: number;
  event_name: string;
  starts_at: string;
  is_past: boolean;
  agenda: string;
  has_attendance: boolean;
  has_minutes: boolean;
  has_summary: boolean;
  present_count: number;
  absent_count: number;
  excused_count: number;
  unmarked_count: number;
  action_item_count: number;
  minutes_updated_at: string | null;
};

export type MeetingListResponse = {
  meetings: MeetingSummary[];
  total: number;
};

export async function fetchMeetings(): Promise<MeetingListResponse> {
  const response = await api.get<MeetingListResponse>("/v1/events/meetings");
  return response.data;
}

export async function fetchMeetingDetail(
  eventId: number,
): Promise<MeetingDetailResponse> {
  const response = await api.get<MeetingDetailResponse>(
    `/v1/events/${eventId}/meeting`,
  );
  return response.data;
}

export async function saveMeetingNotes(
  eventId: number,
  rawNotes: string,
): Promise<MeetingMinutes> {
  const response = await api.put<MeetingMinutes>(
    `/v1/events/${eventId}/meeting/notes`,
    { raw_notes: rawNotes },
  );
  return response.data;
}

export async function summarizeMeetingForEvent(
  eventId: number,
  rawNotes: string,
  options?: {
    confirmRegenerate?: boolean;
    baseDraftVersion?: number | null;
  },
): Promise<MeetingMinutes> {
  const response = await api.post<MeetingMinutes>(
    `/v1/events/${eventId}/meeting/summarize`,
    {
      raw_notes: rawNotes,
      confirm_regenerate: options?.confirmRegenerate ?? false,
      base_draft_version: options?.baseDraftVersion ?? null,
    },
  );
  return response.data;
}

export async function saveMeetingDraft(
  eventId: number,
  draft: MeetingDraftUpdate,
): Promise<MeetingMinutes> {
  const response = await api.put<MeetingMinutes>(
    `/v1/events/${eventId}/meeting/draft`,
    draft,
  );
  return response.data;
}

export async function publishMeetingMinutes(
  eventId: number,
  baseDraftVersion: number,
): Promise<MeetingMinutes> {
  const response = await api.post<MeetingMinutes>(
    `/v1/events/${eventId}/meeting/publish`,
    { base_draft_version: baseDraftVersion },
  );
  return response.data;
}

export async function saveMeetingAttendance(
  eventId: number,
  entries: { member_id: number; status: MeetingAttendanceStatus }[],
): Promise<MeetingDetailResponse> {
  const response = await api.put<MeetingDetailResponse>(
    `/v1/events/${eventId}/meeting/attendance`,
    { entries },
  );
  return response.data;
}

export function meetingRecordStatus(
  source: MeetingSummary | MeetingDetailResponse,
): Pick<
  MeetingSummary,
  | "is_past"
  | "has_attendance"
  | "has_minutes"
  | "has_summary"
  | "present_count"
  | "absent_count"
  | "excused_count"
  | "unmarked_count"
> {
  if ("has_attendance" in source) {
    return source;
  }

  const hasAttendance =
    source.present_count + source.absent_count + source.excused_count > 0;
  const hasMinutes = source.minutes.raw_notes.trim().length > 0;

  return {
    is_past: source.is_past,
    has_attendance: hasAttendance,
    has_minutes: hasMinutes,
    has_summary: Boolean(source.minutes.summary),
    present_count: source.present_count,
    absent_count: source.absent_count,
    excused_count: source.excused_count,
    unmarked_count: source.unmarked_count,
  };
}
