import type { EventType } from "./event-types";
import api from "./api";

export type PhotoAlbumSummary = {
  event_id: number;
  event_name: string;
  starts_at: string;
  event_type: EventType;
  photo_count: number;
  cover_thumbnail_url: string | null;
};

export type PhotoAlbumListResponse = {
  albums: PhotoAlbumSummary[];
  total: number;
};

export type EventPhoto = {
  id: number;
  event_id: number;
  uploaded_by_id: number;
  uploaded_by_name: string;
  image_url: string;
  thumbnail_url: string;
  created_at: string;
  can_delete: boolean;
};

export type EventPhotoListResponse = {
  event_id: number;
  event_name: string;
  photos: EventPhoto[];
  total: number;
};

export async function fetchPhotoAlbums(): Promise<PhotoAlbumListResponse> {
  const response = await api.get<PhotoAlbumListResponse>("/v1/events/photos/albums");
  return response.data;
}

export async function fetchEventPhotos(eventId: number): Promise<EventPhotoListResponse> {
  const response = await api.get<EventPhotoListResponse>(`/v1/events/${eventId}/photos`);
  return response.data;
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

  return response.data;
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
    ) ?? "event-photos.zip";

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
