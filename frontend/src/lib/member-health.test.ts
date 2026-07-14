import { describe, expect, it } from "vitest";

import type { MemberAttendanceRecord } from "./member-attendance";
import { computeMemberAttendanceSummary } from "./member-attendance";
import {
  computeMemberHealth,
  memberHealthBandLabel,
  placeholderMemberHealth,
  scoreToHealthBand,
} from "./member-health";
import type { MemberPaymentsSummary } from "./member-payments";

function missedRecord(
  id: number,
  daysAgo: number,
): MemberAttendanceRecord {
  const startsAt = new Date(Date.UTC(2026, 6, 10 - daysAgo, 18, 0, 0)).toISOString();
  return {
    eventId: id,
    eventName: `Event ${id}`,
    startsAt,
    status: "missed",
  };
}

describe("scoreToHealthBand", () => {
  it("maps score ranges to display bands", () => {
    expect(scoreToHealthBand(92)).toBe("excellent");
    expect(scoreToHealthBand(75)).toBe("good");
    expect(scoreToHealthBand(55)).toBe("needs_attention");
    expect(scoreToHealthBand(40)).toBe("at_risk");
    expect(memberHealthBandLabel("needs_attention")).toBe("Needs Attention");
  });
});

describe("computeMemberHealth", () => {
  it("uses placeholders when factor data is missing", () => {
    const snapshot = placeholderMemberHealth(3, "general");
    expect(snapshot.score).toBeGreaterThan(0);
    expect(snapshot.usingPlaceholders).toBe(true);
    expect(snapshot.factors).toHaveLength(4);
    expect(snapshot.suggestions.length).toBeGreaterThan(0);
    expect(snapshot.bandLabel).toMatch(
      /Excellent|Good|Needs Attention|At Risk/,
    );
  });

  it("raises attendance and payment factors from real summaries", () => {
    const records: MemberAttendanceRecord[] = [
      {
        eventId: 1,
        eventName: "Kickoff",
        startsAt: "2026-06-01T18:00:00.000Z",
        status: "attended",
      },
      {
        eventId: 2,
        eventName: "Mixer",
        startsAt: "2026-06-08T18:00:00.000Z",
        status: "attended",
      },
      {
        eventId: 3,
        eventName: "Town hall",
        startsAt: "2026-06-15T18:00:00.000Z",
        status: "attended",
      },
      {
        eventId: 4,
        eventName: "Workshop",
        startsAt: "2026-06-22T18:00:00.000Z",
        status: "attended",
      },
    ];
    const attendance = computeMemberAttendanceSummary(records);
    const payments: MemberPaymentsSummary = {
      currentSemester: "2026-fall",
      currentBalance: 0,
      outstandingAmount: 0,
      paymentStatus: "paid",
      paymentStatusLabel: "Paid",
      progressPercent: 100,
      nextDueDate: null,
      nextDueLabel: "—",
      history: [],
      hasRecords: true,
    };

    const snapshot = computeMemberHealth({
      memberId: 9,
      role: "general",
      attendance,
      attendanceRecords: records,
      payments,
      taskCompletionPercent: 90,
      activityItems: [
        {
          id: "a1",
          kind: "joined",
          title: "Joined",
          occurredAt: "2026-06-01T12:00:00.000Z",
        },
        {
          id: "a2",
          kind: "paid_dues",
          title: "Paid dues",
          occurredAt: "2026-06-02T12:00:00.000Z",
        },
        {
          id: "a3",
          kind: "attended_event",
          title: "Attended",
          occurredAt: "2026-06-03T12:00:00.000Z",
        },
      ],
    });

    expect(snapshot.usingPlaceholders).toBe(false);
    expect(snapshot.factors.find((f) => f.key === "attendance")?.score).toBe(
      100,
    );
    expect(
      snapshot.factors.find((f) => f.key === "paymentStatus")?.score,
    ).toBe(100);
    expect(snapshot.score).toBeGreaterThanOrEqual(85);
    expect(snapshot.band).toBe("excellent");
    expect(
      snapshot.suggestions.some((s) => /Eligible for leadership/i.test(s.text)),
    ).toBe(true);
  });

  it("suggests missed events and outstanding dues when patterns match", () => {
    const records = [
      missedRecord(1, 1),
      missedRecord(2, 8),
      missedRecord(3, 15),
    ];
    const attendance = computeMemberAttendanceSummary(records);
    const payments: MemberPaymentsSummary = {
      currentSemester: "2026-fall",
      currentBalance: 20,
      outstandingAmount: 20,
      paymentStatus: "unpaid",
      paymentStatusLabel: "Unpaid",
      progressPercent: 0,
      nextDueDate: null,
      nextDueLabel: "—",
      history: [],
      hasRecords: true,
    };

    const snapshot = computeMemberHealth({
      memberId: 4,
      attendance,
      attendanceRecords: records,
      payments,
      taskCompletionPercent: 40,
    });

    expect(
      snapshot.suggestions.some((s) => /Missed last three events/i.test(s.text)),
    ).toBe(true);
    expect(
      snapshot.suggestions.some((s) => /Outstanding dues/i.test(s.text)),
    ).toBe(true);
    expect(snapshot.band === "needs_attention" || snapshot.band === "at_risk").toBe(
      true,
    );
  });
});
