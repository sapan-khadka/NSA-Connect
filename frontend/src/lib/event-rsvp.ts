import type { RsvpStatus } from "./events-api";

export function isEventUpcoming(startsAt: string): boolean {
  return new Date(startsAt) > new Date();
}

export const RSVP_STATUS_LABELS: Record<RsvpStatus, string> = {
  going: "Going",
  maybe: "Maybe",
  not_going: "Not going",
};

export function formatRsvpStatus(status: RsvpStatus): string {
  return RSVP_STATUS_LABELS[status];
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
