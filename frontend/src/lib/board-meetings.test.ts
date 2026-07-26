import { describe, expect, it } from "vitest";

import {
  calcBoardMeetingsStats,
  filterMeetings,
  getMeetingStatusMarks,
  groupMeetingsBySemester,
  meetingNeedsAttention,
  meetingSubtitle,
} from "./board-meetings";
import type { MeetingSummary } from "./meetings-api";

function meeting(
  overrides: Partial<MeetingSummary> & Pick<MeetingSummary, "event_id" | "event_name">,
): MeetingSummary {
  return {
    starts_at: "2026-07-22T18:00:00+00:00",
    is_past: true,
    agenda: "Walkthrough meeting",
    has_attendance: false,
    has_minutes: false,
    has_summary: false,
    present_count: 0,
    absent_count: 0,
    excused_count: 0,
    unmarked_count: 0,
    action_item_count: 0,
    minutes_updated_at: null,
    ...overrides,
  };
}

describe("calcBoardMeetingsStats", () => {
  it("counts unique missing and ready metrics", () => {
    const stats = calcBoardMeetingsStats([
      meeting({
        event_id: 1,
        event_name: "A",
        is_past: false,
      }),
      meeting({
        event_id: 2,
        event_name: "B",
        has_attendance: true,
        has_minutes: true,
      }),
      meeting({
        event_id: 3,
        event_name: "C",
        has_attendance: true,
        has_minutes: false,
      }),
      meeting({
        event_id: 4,
        event_name: "D",
        has_attendance: false,
        has_minutes: false,
      }),
    ]);

    expect(stats).toEqual({
      total: 4,
      needMinutes: 2,
      needAttendance: 1,
      ready: 1,
    });
  });
});

describe("meetingNeedsAttention", () => {
  it("flags past meetings missing records", () => {
    expect(
      meetingNeedsAttention(
        meeting({ event_id: 1, event_name: "A", has_attendance: true }),
      ),
    ).toBe(true);
    expect(
      meetingNeedsAttention(
        meeting({
          event_id: 2,
          event_name: "B",
          has_attendance: true,
          has_minutes: true,
        }),
      ),
    ).toBe(false);
  });
});

describe("groupMeetingsBySemester", () => {
  it("groups by semester and month", () => {
    const groups = groupMeetingsBySemester([
      meeting({
        event_id: 1,
        event_name: "Upcoming",
        is_past: false,
        starts_at: "2026-08-01T18:00:00+00:00",
      }),
      meeting({
        event_id: 2,
        event_name: "July meeting",
        starts_at: "2026-07-22T18:00:00+00:00",
      }),
      meeting({
        event_id: 3,
        event_name: "June meeting",
        starts_at: "2026-06-10T18:00:00+00:00",
      }),
      meeting({
        event_id: 4,
        event_name: "Spring",
        starts_at: "2026-03-10T18:00:00+00:00",
      }),
    ]);

    expect(groups.map((group) => group.label)).toEqual([
      "Upcoming",
      "Summer 2026",
      "Spring 2026",
    ]);
    expect(groups[1]?.months.map((month) => month.label)).toEqual([
      "July 2026",
      "June 2026",
    ]);
  });
});

describe("filterMeetings", () => {
  it("filters by search and ready records", () => {
    const meetings = [
      meeting({
        event_id: 1,
        event_name: "Election",
        agenda: "Officer elections",
        has_attendance: true,
        has_minutes: true,
      }),
      meeting({
        event_id: 2,
        event_name: "WT Meeting 5",
        agenda: "Walkthrough",
      }),
    ];

    expect(
      filterMeetings(meetings, {
        search: "walk",
        status: "all",
        year: "all",
        missing: "all",
      }).map((item) => item.event_id),
    ).toEqual([2]);

    expect(
      filterMeetings(meetings, {
        search: "",
        status: "all",
        year: "all",
        missing: "ready",
      }).map((item) => item.event_id),
    ).toEqual([1]);
  });
});

describe("getMeetingStatusMarks / subtitle", () => {
  it("returns monochrome scan marks for past meetings", () => {
    expect(
      getMeetingStatusMarks(
        meeting({
          event_id: 1,
          event_name: "A",
          has_attendance: true,
          has_minutes: false,
        }),
      ),
    ).toEqual([
      { key: "attendance", label: "Attendance", done: true },
      { key: "minutes", label: "Minutes", done: false },
    ]);

    expect(
      getMeetingStatusMarks(
        meeting({
          event_id: 2,
          event_name: "B",
          is_past: false,
        }),
      ),
    ).toBeNull();

    expect(
      meetingSubtitle(
        meeting({
          event_id: 1,
          event_name: "A",
          agenda: "",
        }),
      ),
    ).toBe("Board meeting");
  });
});
