import { describe, expect, it } from "vitest";

import { pickFocusMeeting } from "../components/home/HomeMeetingMinutesCard";
import type { MeetingSummary } from "./meetings-api";

function meeting(
  overrides: Partial<MeetingSummary> & Pick<MeetingSummary, "event_id" | "event_name">,
): MeetingSummary {
  return {
    starts_at: "2030-06-01T18:00:00+00:00",
    is_past: false,
    agenda: "",
    has_attendance: false,
    has_minutes: false,
    has_summary: false,
    present_count: 0,
    absent_count: 0,
    excused_count: 0,
    unmarked_count: 0,
    minutes_updated_at: null,
    ...overrides,
  };
}

describe("pickFocusMeeting", () => {
  it("prefers the soonest upcoming meeting that still needs notes", () => {
    const focus = pickFocusMeeting([
      meeting({
        event_id: 1,
        event_name: "Done upcoming",
        starts_at: "2030-05-01T18:00:00+00:00",
        has_minutes: true,
      }),
      meeting({
        event_id: 2,
        event_name: "Needs notes later",
        starts_at: "2030-07-01T18:00:00+00:00",
      }),
      meeting({
        event_id: 3,
        event_name: "Needs notes sooner",
        starts_at: "2030-06-01T18:00:00+00:00",
      }),
    ]);
    expect(focus?.event_id).toBe(3);
  });

  it("falls back to the most recent past meeting without minutes", () => {
    const focus = pickFocusMeeting([
      meeting({
        event_id: 1,
        event_name: "Old",
        starts_at: "2020-01-01T18:00:00+00:00",
        is_past: true,
      }),
      meeting({
        event_id: 2,
        event_name: "Recent past",
        starts_at: "2020-06-01T18:00:00+00:00",
        is_past: true,
      }),
    ]);
    expect(focus?.event_id).toBe(2);
  });
});
