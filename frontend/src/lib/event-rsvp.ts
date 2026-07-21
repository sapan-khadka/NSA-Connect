import type { EventAttendeesResponse, RsvpStatus } from "./events-api";

export function isEventUpcoming(startsAt: string): boolean {
  return new Date(startsAt) > new Date();
}

export const RSVP_STATUS_LABELS: Record<RsvpStatus, string> = {
  going: "Going",
  maybe: "Maybe",
  not_going: "Not going",
  waitlisted: "Waitlisted",
};

export const RSVP_NO_RESPONSE_LABEL = "Not yet responded";

export function formatRsvpStatus(status: RsvpStatus | null): string {
  if (status === null) {
    return RSVP_NO_RESPONSE_LABEL;
  }
  return RSVP_STATUS_LABELS[status];
}

export function formatCompactAttendeeSummary(
  data: Pick<EventAttendeesResponse, "going_count" | "no_response_count">,
): string {
  return `${data.going_count} going · ${data.no_response_count} not yet responded`;
}

export function needsRsvpResponse(
  startsAt: string,
  currentStatus: RsvpStatus | null,
): boolean {
  return isEventUpcoming(startsAt) && currentStatus === null;
}

export function applyRsvpStatus<T extends {
  id: number;
  current_member_rsvp_status: RsvpStatus | null;
}>(
  event: T,
  status: {
    event_id: number;
    current_member_rsvp_status: RsvpStatus | null;
  },
): T {
  if (event.id !== status.event_id) {
    return event;
  }

  return {
    ...event,
    current_member_rsvp_status: status.current_member_rsvp_status,
  };
}
