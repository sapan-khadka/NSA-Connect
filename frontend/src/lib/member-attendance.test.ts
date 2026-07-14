import { describe, expect, it } from "vitest";

import {
  attendanceRatePercent,
  attendanceTrendLabel,
  computeAttendanceTrend,
  computeMemberAttendanceSummary,
  type MemberAttendanceRecord,
} from "./member-attendance";

function record(
  partial: Partial<MemberAttendanceRecord> &
    Pick<MemberAttendanceRecord, "eventId" | "status" | "startsAt">,
): MemberAttendanceRecord {
  return {
    eventName: `Event ${partial.eventId}`,
    ...partial,
  };
}

describe("attendanceRatePercent", () => {
  it("uses attended / (attended + missed)", () => {
    expect(attendanceRatePercent(2, 1)).toBe(67);
    expect(attendanceRatePercent(3, 1)).toBe(75);
    expect(attendanceRatePercent(0, 0)).toBe(0);
    expect(attendanceRatePercent(0, 4)).toBe(0);
    expect(attendanceRatePercent(4, 0)).toBe(100);
  });
});

describe("computeMemberAttendanceSummary", () => {
  it("counts attended, missed, and excused; excludes excused from progress", () => {
    const summary = computeMemberAttendanceSummary([
      record({
        eventId: 1,
        status: "attended",
        startsAt: "2026-01-01T00:00:00Z",
      }),
      record({
        eventId: 2,
        status: "missed",
        startsAt: "2026-02-01T00:00:00Z",
      }),
      record({
        eventId: 3,
        status: "excused",
        startsAt: "2026-03-01T00:00:00Z",
      }),
      record({
        eventId: 4,
        status: "attended",
        startsAt: "2026-04-01T00:00:00Z",
      }),
    ]);

    expect(summary.eventsAttended).toBe(2);
    expect(summary.eventsMissed).toBe(1);
    expect(summary.eventsExcused).toBe(1);
    expect(summary.countedEvents).toBe(3);
    expect(summary.progressPercent).toBe(67);
    expect(summary.recent.map((r) => r.eventId)).toEqual([4, 3, 2, 1]);
  });

  it("limits recent list to five newest events", () => {
    const records = Array.from({ length: 7 }, (_, i) =>
      record({
        eventId: i + 1,
        status: "attended",
        startsAt: `2026-0${i + 1}-01T00:00:00Z`,
      }),
    );
    const summary = computeMemberAttendanceSummary(records);
    expect(summary.recent).toHaveLength(5);
    expect(summary.recent[0]?.eventId).toBe(7);
  });
});

describe("computeAttendanceTrend", () => {
  it("returns insufficient when fewer than six counted events", () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      record({
        eventId: i + 1,
        status: i % 2 === 0 ? "attended" : "missed",
        startsAt: `2026-0${i + 1}-01T00:00:00Z`,
      }),
    );
    expect(computeAttendanceTrend(records.reverse())).toBe("insufficient");
  });

  it("detects improving and declining trends", () => {
    // Newest first: 3 recent all attended, 3 prior all missed → up
    const improving: MemberAttendanceRecord[] = [
      record({ eventId: 6, status: "attended", startsAt: "2026-06-01T00:00:00Z" }),
      record({ eventId: 5, status: "attended", startsAt: "2026-05-01T00:00:00Z" }),
      record({ eventId: 4, status: "attended", startsAt: "2026-04-01T00:00:00Z" }),
      record({ eventId: 3, status: "missed", startsAt: "2026-03-01T00:00:00Z" }),
      record({ eventId: 2, status: "missed", startsAt: "2026-02-01T00:00:00Z" }),
      record({ eventId: 1, status: "missed", startsAt: "2026-01-01T00:00:00Z" }),
    ];
    expect(computeAttendanceTrend(improving)).toBe("up");

    const declining: MemberAttendanceRecord[] = [
      record({ eventId: 6, status: "missed", startsAt: "2026-06-01T00:00:00Z" }),
      record({ eventId: 5, status: "missed", startsAt: "2026-05-01T00:00:00Z" }),
      record({ eventId: 4, status: "missed", startsAt: "2026-04-01T00:00:00Z" }),
      record({ eventId: 3, status: "attended", startsAt: "2026-03-01T00:00:00Z" }),
      record({ eventId: 2, status: "attended", startsAt: "2026-02-01T00:00:00Z" }),
      record({ eventId: 1, status: "attended", startsAt: "2026-01-01T00:00:00Z" }),
    ];
    expect(computeAttendanceTrend(declining)).toBe("down");
  });
});

describe("attendanceTrendLabel", () => {
  it("maps directions to readable labels", () => {
    expect(attendanceTrendLabel("up")).toBe("Improving");
    expect(attendanceTrendLabel("down")).toBe("Declining");
    expect(attendanceTrendLabel("steady")).toBe("Steady");
    expect(attendanceTrendLabel("insufficient")).toBe("Not enough history");
  });
});
