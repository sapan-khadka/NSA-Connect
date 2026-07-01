import { toLocalIsoDate } from "./calendar";

export function eventDetailPath(eventId: number): string {
  return `/events/${eventId}`;
}

export function calendarDeepLink(event: {
  id: number;
  starts_at: string;
}): string {
  const date = toLocalIsoDate(new Date(event.starts_at));
  return `/events/calendar?date=${date}&event=${event.id}`;
}
