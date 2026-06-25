export function isEventUpcoming(startsAt: string): boolean {
  return new Date(startsAt) > new Date();
}

export function applyRsvpStatus<T extends {
  id: number;
  rsvp_count: number;
  current_member_has_rsvped: boolean;
}>(
  event: T,
  status: {
    event_id: number;
    rsvp_count: number;
    current_member_has_rsvped: boolean;
  },
): T {
  if (event.id !== status.event_id) {
    return event;
  }

  return {
    ...event,
    rsvp_count: status.rsvp_count,
    current_member_has_rsvped: status.current_member_has_rsvped,
  };
}
