import type { EventAttendanceSummary } from "./event-checkin-api";
import type { EventAttendeesResponse } from "./events-api";

export type RsvpAnalyticsSnapshot = {
  going: number;
  maybe: number;
  declined: number;
  noResponse: number;
  /** Expected turnout from existing RSVP counts: going + half of maybe. */
  attendancePrediction: number;
  /** No-show rate among Going RSVPs when check-in summary exists; otherwise null. */
  noShowRatePercent: number | null;
  /** Share of responded RSVPs that are Going. */
  capacityFilledPercent: number | null;
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
    "going_count" | "maybe_count" | "not_going_count" | "no_response_count"
  > | null,
  attendanceSummary: EventAttendanceSummary | null,
): RsvpAnalyticsSnapshot | null {
  if (!attendees) {
    return null;
  }

  const going = attendees.going_count;
  const maybe = attendees.maybe_count;
  const declined = attendees.not_going_count;
  const noResponse = attendees.no_response_count;
  const totalResponded = going + maybe + declined;
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

  const capacityFilledPercent =
    totalResponded > 0 ? Math.round((going / totalResponded) * 100) : null;

  return {
    going,
    maybe,
    declined,
    noResponse,
    attendancePrediction,
    noShowRatePercent,
    capacityFilledPercent,
    totalResponded,
    totalRsvps,
  };
}

export function rsvpDonutSegments(snapshot: RsvpAnalyticsSnapshot): {
  key: "going" | "maybe" | "declined";
  label: string;
  value: number;
  color: string;
}[] {
  return [
    { key: "going", label: "Going", value: snapshot.going, color: "#0F766E" },
    { key: "maybe", label: "Maybe", value: snapshot.maybe, color: "#D97706" },
    {
      key: "declined",
      label: "Declined",
      value: snapshot.declined,
      color: "#9CA3AF",
    },
  ];
}
