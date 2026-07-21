import api from "./api";

export type AnnouncementCategory = "general" | "urgent" | "event_related";
export type AnnouncementAudience =
  | "all_approved"
  | "going"
  | "maybe"
  | "no_rsvp";

export type AnnouncementAuthor = {
  id: number;
  full_name: string;
};

export type Announcement = {
  id: number;
  title: string;
  body: string;
  category: AnnouncementCategory;
  audience: AnnouncementAudience;
  event_id: number | null;
  author: AnnouncementAuthor;
  created_at: string;
  updated_at: string;
};

export type AnnouncementListResponse = {
  announcements: Announcement[];
  total: number;
};

export type AnnouncementCreatePayload = {
  title: string;
  body: string;
  category?: AnnouncementCategory;
  audience?: AnnouncementAudience;
  event_id?: number | null;
};

export type AnnouncementUpdatePayload = Partial<
  Pick<AnnouncementCreatePayload, "title" | "body" | "category">
>;

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  general: "General",
  urgent: "Urgent",
  event_related: "Event-related",
};

export const ANNOUNCEMENT_AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  all_approved: "All approved members",
  going: "Going RSVPs",
  maybe: "Maybe RSVPs",
  no_rsvp: "No RSVP yet",
};

export type AnnouncementRecipientPreview = {
  audience: AnnouncementAudience;
  event_id: number | null;
  total: number;
  emailable: number;
};

export async function fetchAnnouncements(params?: {
  event_id?: number;
}): Promise<AnnouncementListResponse> {
  const response = await api.get<AnnouncementListResponse>("/v1/announcements", {
    params,
  });
  return response.data;
}

export async function fetchAnnouncementRecipientPreview(params: {
  audience: AnnouncementAudience;
  event_id?: number | null;
}): Promise<AnnouncementRecipientPreview> {
  const response = await api.get<AnnouncementRecipientPreview>(
    "/v1/announcements/recipient-preview",
    { params },
  );
  return response.data;
}

export async function createAnnouncement(
  payload: AnnouncementCreatePayload,
): Promise<Announcement> {
  const response = await api.post<Announcement>("/v1/announcements", payload);
  return response.data;
}

export async function updateAnnouncement(
  announcementId: number,
  payload: AnnouncementUpdatePayload,
): Promise<Announcement> {
  const response = await api.patch<Announcement>(
    `/v1/announcements/${announcementId}`,
    payload,
  );
  return response.data;
}

export async function deleteAnnouncement(announcementId: number): Promise<void> {
  await api.delete(`/v1/announcements/${announcementId}`);
}
