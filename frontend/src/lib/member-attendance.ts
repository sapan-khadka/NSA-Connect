/**
 * Member attendance presentation helpers.
 * Rate math is unchanged from the standard attended / (attended + missed) share;
 * UI surfaces counts and trend labels rather than leading with percentages.
 */

export type MemberAttendanceStatus = "attended" | "missed" | "excused";

export type MemberAttendanceRecord = {
  eventId: number;
  eventName: string;
  startsAt: string;
  status: MemberAttendanceStatus;
};

export type AttendanceTrendDirection = "up" | "down" | "steady" | "insufficient";

export type MemberAttendanceSummary = {
  eventsAttended: number;
  eventsMissed: number;
  eventsExcused: number;
  /** Events that count toward the attendance share (attended + missed). */
  countedEvents: number;
  /**
   * 0–100 share used only for progress ring / bar fill.
   * Formula: round(attended / (attended + missed) * 100), or 0 when none counted.
   */
  progressPercent: number;
  trend: AttendanceTrendDirection;
  /** Recent records, newest first (already sorted). */
  recent: MemberAttendanceRecord[];
};

const RECENT_LIMIT = 5;
const TREND_WINDOW = 3;
/** Percentage-point delta below this maps to "steady". */
const STEADY_THRESHOLD = 5;

export function attendanceRatePercent(
  attended: number,
  missed: number,
): number {
  const counted = attended + missed;
  if (counted <= 0) {
    return 0;
  }
  return Math.round((attended / counted) * 100);
}

function rateFromRecords(records: MemberAttendanceRecord[]): number {
  let attended = 0;
  let missed = 0;
  for (const record of records) {
    if (record.status === "attended") {
      attended += 1;
    } else if (record.status === "missed") {
      missed += 1;
    }
  }
  return attendanceRatePercent(attended, missed);
}

export function computeAttendanceTrend(
  chronologicalNewestFirst: MemberAttendanceRecord[],
): AttendanceTrendDirection {
  const counted = chronologicalNewestFirst.filter(
    (r) => r.status === "attended" || r.status === "missed",
  );
  if (counted.length < TREND_WINDOW * 2) {
    return "insufficient";
  }

  const recent = counted.slice(0, TREND_WINDOW);
  const prior = counted.slice(TREND_WINDOW, TREND_WINDOW * 2);
  const recentRate = rateFromRecords(recent);
  const priorRate = rateFromRecords(prior);
  const delta = recentRate - priorRate;

  if (Math.abs(delta) < STEADY_THRESHOLD) {
    return "steady";
  }
  return delta > 0 ? "up" : "down";
}

export function computeMemberAttendanceSummary(
  records: MemberAttendanceRecord[],
): MemberAttendanceSummary {
  let eventsAttended = 0;
  let eventsMissed = 0;
  let eventsExcused = 0;

  for (const record of records) {
    if (record.status === "attended") {
      eventsAttended += 1;
    } else if (record.status === "missed") {
      eventsMissed += 1;
    } else {
      eventsExcused += 1;
    }
  }

  const countedEvents = eventsAttended + eventsMissed;
  const sorted = [...records].sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );

  return {
    eventsAttended,
    eventsMissed,
    eventsExcused,
    countedEvents,
    progressPercent: attendanceRatePercent(eventsAttended, eventsMissed),
    trend: computeAttendanceTrend(sorted),
    recent: sorted.slice(0, RECENT_LIMIT),
  };
}

export function attendanceTrendLabel(
  trend: AttendanceTrendDirection,
): string {
  switch (trend) {
    case "up":
      return "Improving";
    case "down":
      return "Declining";
    case "steady":
      return "Steady";
    case "insufficient":
      return "Not enough history";
  }
}
