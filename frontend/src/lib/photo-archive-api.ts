import type { EventType } from "./event-types";
import api from "./api";

export type MediaKind = "photo" | "video";
export type MediaAlbumKind = "event" | "custom";

export type PhotoAlbumSummary = {
  kind: MediaAlbumKind;
  id: number;
  title: string;
  starts_at: string | null;
  event_type: EventType | null;
  photo_count: number;
  video_count: number;
  cover_thumbnail_url: string | null;
  /** @deprecated use id + kind */
  event_id?: number;
  /** @deprecated use title */
  event_name?: string;
};

export type PhotoAlbumListResponse = {
  albums: PhotoAlbumSummary[];
  total: number;
};

export type MediaItem = {
  id: number;
  uploaded_by_id: number;
  uploaded_by_name: string;
  image_url: string;
  thumbnail_url: string;
  created_at: string;
  can_delete: boolean;
  media_kind: MediaKind;
  duration_seconds: number | null;
};

/** Event-album media item (legacy field name kept for callers). */
export type EventPhoto = MediaItem & {
  event_id: number;
};

export type EventPhotoListResponse = {
  event_id: number;
  event_name: string;
  photos: EventPhoto[];
  total: number;
  photo_count: number;
  video_count: number;
};

export type CustomMediaAlbumDetail = {
  id: number;
  title: string;
  created_by_id: number;
  created_at: string;
  updated_at: string;
  can_manage: boolean;
  items: MediaItem[];
  total: number;
  photo_count: number;
  video_count: number;
};

function normalizeAlbum(raw: PhotoAlbumSummary): PhotoAlbumSummary {
  const kind = raw.kind ?? "event";
  const id = raw.id ?? raw.event_id ?? 0;
  return {
    kind,
    id,
    title: raw.title ?? raw.event_name ?? "Album",
    starts_at: raw.starts_at ?? null,
    event_type: raw.event_type ?? null,
    photo_count: raw.photo_count ?? 0,
    video_count: raw.video_count ?? 0,
    cover_thumbnail_url: raw.cover_thumbnail_url ?? null,
    event_id: kind === "event" ? id : undefined,
    event_name: raw.title ?? raw.event_name,
  };
}

function normalizeMediaItem(item: MediaItem): MediaItem {
  return {
    ...item,
    media_kind: item.media_kind === "video" ? "video" : "photo",
    duration_seconds: item.duration_seconds ?? null,
  };
}

export async function fetchPhotoAlbums(): Promise<PhotoAlbumListResponse> {
  const response = await api.get<PhotoAlbumListResponse>("/v1/media/albums");
  return {
    ...response.data,
    albums: response.data.albums.map(normalizeAlbum),
  };
}

export async function createMediaAlbum(title: string): Promise<PhotoAlbumSummary> {
  const response = await api.post<PhotoAlbumSummary>("/v1/media/albums", { title });
  return normalizeAlbum(response.data);
}

export async function fetchCustomMediaAlbum(
  albumId: number,
): Promise<CustomMediaAlbumDetail> {
  const response = await api.get<CustomMediaAlbumDetail>(
    `/v1/media/albums/${albumId}`,
  );
  const data = response.data;
  return {
    ...data,
    items: data.items.map(normalizeMediaItem),
    photo_count:
      data.photo_count ??
      data.items.filter((item) => item.media_kind !== "video").length,
    video_count:
      data.video_count ??
      data.items.filter((item) => item.media_kind === "video").length,
  };
}

export async function renameMediaAlbum(
  albumId: number,
  title: string,
): Promise<PhotoAlbumSummary> {
  const response = await api.patch<PhotoAlbumSummary>(
    `/v1/media/albums/${albumId}`,
    { title },
  );
  return normalizeAlbum(response.data);
}

export async function deleteMediaAlbum(albumId: number): Promise<void> {
  await api.delete(`/v1/media/albums/${albumId}`);
}

export async function uploadMediaAlbumItem(
  albumId: number,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<MediaItem> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<MediaItem>(
    `/v1/media/albums/${albumId}/items`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) {
          return;
        }
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    },
  );
  return normalizeMediaItem(response.data);
}

export async function deleteMediaAlbumItem(
  albumId: number,
  itemId: number,
): Promise<void> {
  await api.delete(`/v1/media/albums/${albumId}/items/${itemId}`);
}

export async function downloadCustomMediaAlbum(
  albumId: number,
  options?: {
    timeoutMs?: number;
    signal?: AbortSignal;
  },
): Promise<{ blob: Blob; filename: string }> {
  const response = await api.post<Blob>(
    `/v1/media/albums/${albumId}/download`,
    null,
    {
      responseType: "blob",
      timeout: options?.timeoutMs ?? ALBUM_DOWNLOAD_TIMEOUT_MS,
      signal: options?.signal,
    },
  );
  const filename =
    parseContentDispositionFilename(
      typeof response.headers["content-disposition"] === "string"
        ? response.headers["content-disposition"]
        : undefined,
    ) ?? "album-media.zip";
  return { blob: response.data, filename };
}

export async function fetchEventPhotos(eventId: number): Promise<EventPhotoListResponse> {
  const response = await api.get<EventPhotoListResponse>(`/v1/events/${eventId}/photos`);
  const data = response.data;
  return {
    ...data,
    photos: data.photos.map((photo) => ({
      ...normalizeMediaItem(photo),
      event_id: photo.event_id,
    })),
    photo_count: data.photo_count ?? data.photos.filter((p) => p.media_kind !== "video").length,
    video_count:
      data.video_count ?? data.photos.filter((p) => p.media_kind === "video").length,
  };
}

export async function uploadEventPhoto(
  eventId: number,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<EventPhoto> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<EventPhoto>(`/v1/events/${eventId}/photos`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) {
        return;
      }
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });

  const photo = response.data;
  return {
    ...normalizeMediaItem(photo),
    event_id: photo.event_id,
  };
}

export async function deleteEventPhoto(eventId: number, photoId: number): Promise<void> {
  await api.delete(`/v1/events/${eventId}/photos/${photoId}`);
}

export const LARGE_ALBUM_PHOTO_THRESHOLD = 50;
export const ALBUM_DOWNLOAD_TIMEOUT_MS = 120_000;

function parseContentDispositionFilename(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const quotedMatch = header.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = header.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return null;
}

export async function downloadEventPhotoAlbum(
  eventId: number,
  options?: {
    timeoutMs?: number;
    signal?: AbortSignal;
  },
): Promise<{ blob: Blob; filename: string }> {
  const response = await api.post<Blob>(
    `/v1/events/${eventId}/photos/download`,
    null,
    {
      responseType: "blob",
      timeout: options?.timeoutMs ?? ALBUM_DOWNLOAD_TIMEOUT_MS,
      signal: options?.signal,
    },
  );

  const filename =
    parseContentDispositionFilename(
      typeof response.headers["content-disposition"] === "string"
        ? response.headers["content-disposition"]
        : undefined,
    ) ?? "event-media.zip";

  return { blob: response.data, filename };
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function formatMediaDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return "";
  }
  const whole = Math.round(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
