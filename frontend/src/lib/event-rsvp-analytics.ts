import type { EventAttendanceSummary } from "./event-checkin-api";
import type { EventAttendeesResponse } from "./events-api";

export type RsvpAnalyticsSnapshot = {
  going: number;
  maybe: number;
  declined: number;
  noResponse: number;
  waitlisted: number;
  /** Expected turnout from existing RSVP counts: going + half of maybe. */
  attendancePrediction: number;
  /** No-show rate among Going RSVPs when check-in summary exists; otherwise null. */
  noShowRatePercent: number | null;
  /**
   * Share of event capacity filled by Going RSVPs when capacity is set;
   * otherwise null.
   */
  capacityFilledPercent: number | null;
  /** Share of responded RSVPs that are Going (not venue capacity). */
  responseGoingPercent: number | null;
  totalResponded: number;
  totalRsvps: number;
};

/**
 * Derive RSVP analytics presentation values from existing API counts.
 * Does not change how those counts are calculated on the server.
 */
export function computeRsvpAnalytics(
  attendees: Pick<
    EventAttendeesResponse,
    | "going_count"
    | "maybe_count"
    | "not_going_count"
    | "no_response_count"
  > & { waitlisted_count?: number } | null,
  attendanceSummary: EventAttendanceSummary | null,
  eventCapacity: number | null = null,
): RsvpAnalyticsSnapshot | null {
  if (!attendees) {
    return null;
  }

  const going = attendees.going_count;
  const maybe = attendees.maybe_count;
  const declined = attendees.not_going_count;
  const noResponse = attendees.no_response_count;
  const waitlisted = attendees.waitlisted_count ?? 0;
  const totalResponded = going + maybe + declined + waitlisted;
  const totalRsvps = totalResponded + noResponse;

  const attendancePrediction = going + Math.round(maybe * 0.5);

  let noShowRatePercent: number | null = null;
  if (attendanceSummary) {
    const attended = attendanceSummary.going_attended.count;
    const noShow = attendanceSummary.going_no_show.count;
    const goingPool = attended + noShow;
    noShowRatePercent =
      goingPool > 0 ? Math.round((noShow / goingPool) * 100) : 0;
  }

  const responseGoingPercent =
    totalResponded > 0 ? Math.round((going / totalResponded) * 100) : null;

  const capacityFilledPercent =
    eventCapacity !== null && eventCapacity > 0
      ? Math.min(100, Math.round((going / eventCapacity) * 100))
      : null;

  return {
    going,
    maybe,
    declined,
    noResponse,
    waitlisted,
    attendancePrediction,
    noShowRatePercent,
    capacityFilledPercent,
    responseGoingPercent,
    totalResponded,
    totalRsvps,
  };
}

export function rsvpDonutSegments(snapshot: RsvpAnalyticsSnapshot): {
  key: "going" | "maybe" | "declined" | "waitlisted";
  label: string;
  value: number;
  color: string;
}[] {
  const segments: {
    key: "going" | "maybe" | "declined" | "waitlisted";
    label: string;
    value: number;
    color: string;
  }[] = [
    { key: "going", label: "Going", value: snapshot.going, color: "#0F766E" },
    { key: "maybe", label: "Maybe", value: snapshot.maybe, color: "#D97706" },
    {
      key: "declined",
      label: "Declined",
      value: snapshot.declined,
      color: "#9CA3AF",
    },
  ];
  if (snapshot.waitlisted > 0) {
    segments.push({
      key: "waitlisted",
      label: "Waitlisted",
      value: snapshot.waitlisted,
      color: "#6366F1",
    });
  }
  return segments;
}
