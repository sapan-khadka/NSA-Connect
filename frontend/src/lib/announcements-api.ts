import api from "./api";

export type AnnouncementCategory = "general" | "urgent" | "event_related";

export type AnnouncementAuthor = {
  id: number;
  full_name: string;
};

export type Announcement = {
  id: number;
  title: string;
  body: string;
  category: AnnouncementCategory;
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
};

export type AnnouncementUpdatePayload = Partial<AnnouncementCreatePayload>;

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  general: "General",
  urgent: "Urgent",
  event_related: "Event-related",
};

export async function fetchAnnouncements(): Promise<AnnouncementListResponse> {
  const response = await api.get<AnnouncementListResponse>("/v1/announcements");
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
