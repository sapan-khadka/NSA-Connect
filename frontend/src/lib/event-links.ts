import { toLocalIsoDate } from "./calendar";

export function eventDetailPath(eventId: number): string {
  return `/events/${eventId}`;
}

/** Unauthenticated shareable landing page for an event. */
export function publicEventPath(eventId: number): string {
  return `/e/${eventId}`;
}

export function photoArchivePath(): string {
  return "/events/media";
}

export function photoAlbumPath(eventId: number): string {
  return `/events/media/${eventId}`;
}

export function customMediaAlbumPath(albumId: number): string {
  return `/events/media/album/${albumId}`;
}

export function mediaAlbumHref(album: {
  kind: "event" | "custom";
  id: number;
}): string {
  return album.kind === "custom"
    ? customMediaAlbumPath(album.id)
    : photoAlbumPath(album.id);
}

export function calendarDeepLink(event: {
  id: number;
  starts_at: string;
}): string {
  const date = toLocalIsoDate(new Date(event.starts_at));
  return `/events/calendar?date=${date}&event=${event.id}`;
}
