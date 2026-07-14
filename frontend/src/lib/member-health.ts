/**
 * Member Health — client-side engagement score for UX.
 * Uses attendance / payments when provided; otherwise stable placeholders.
 * No backend health API.
 */

import type { MemberAttendanceRecord, MemberAttendanceSummary } from "./member-attendance";
import type { MemberPaymentsSummary } from "./member-payments";
import type { MemberActivityItem } from "./member-activity-timeline";
import type { MemberRole } from "./roles";

export type MemberHealthBand =
  | "excellent"
  | "good"
  | "needs_attention"
  | "at_risk";

export type MemberHealthFactorKey =
  | "attendance"
  | "taskCompletion"
  | "paymentStatus"
  | "recentActivity";

export type MemberHealthFactor = {
  key: MemberHealthFactorKey;
  label: string;
  score: number;
  detail: string;
  available: boolean;
};

export type MemberHealthSuggestion = {
  id: string;
  text: string;
  tone: "attention" | "risk" | "opportunity" | "positive";
};

export type MemberHealthSnapshot = {
  score: number;
  band: MemberHealthBand;
  bandLabel: string;
  factors: MemberHealthFactor[];
  suggestions: MemberHealthSuggestion[];
  usingPlaceholders: boolean;
};

export type MemberHealthInput = {
  memberId?: number;
  role?: MemberRole | string;
  attendance?: MemberAttendanceSummary | null;
  attendanceRecords?: MemberAttendanceRecord[];
  payments?: MemberPaymentsSummary | null;
  /** 0–100 when a task API exists; omitted → placeholder. */
  taskCompletionPercent?: number | null;
  activityItems?: MemberActivityItem[] | null;
};

const WEIGHTS: Record<MemberHealthFactorKey, number> = {
  attendance: 0.35,
  taskCompletion: 0.2,
  paymentStatus: 0.3,
  recentActivity: 0.15,
};

export function memberHealthBandLabel(band: MemberHealthBand): string {
  switch (band) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "needs_attention":
      return "Needs Attention";
    case "at_risk":
      return "At Risk";
  }
}

export function scoreToHealthBand(score: number): MemberHealthBand {
  if (score >= 85) {
    return "excellent";
  }
  if (score >= 70) {
    return "good";
  }
  if (score >= 50) {
    return "needs_attention";
  }
  return "at_risk";
}

/** Stable 0–99 value from a member id for placeholder variety. */
function seedUnit(memberId: number | undefined, salt: number): number {
  const id = Number.isFinite(memberId) ? Math.abs(memberId ?? 0) : 0;
  return (id * 37 + salt * 53) % 100;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function paymentScoreFromSummary(
  payments: MemberPaymentsSummary | null | undefined,
): { score: number; detail: string; available: boolean } {
  if (!payments || !payments.hasRecords || !payments.paymentStatus) {
    return { score: 0, detail: "No payment history yet", available: false };
  }

  switch (payments.paymentStatus) {
    case "paid":
    case "exempt":
      return {
        score: 100,
        detail: payments.paymentStatusLabel,
        available: true,
      };
    case "partial":
      return {
        score: 58,
        detail: payments.paymentStatusLabel,
        available: true,
      };
    case "unpaid":
      return {
        score: payments.outstandingAmount > 0 ? 28 : 40,
        detail: payments.paymentStatusLabel,
        available: true,
      };
    default:
      return {
        score: 50,
        detail: payments.paymentStatusLabel,
        available: true,
      };
  }
}

function attendanceScoreFromSummary(
  attendance: MemberAttendanceSummary | null | undefined,
): { score: number; detail: string; available: boolean } {
  if (!attendance || attendance.countedEvents <= 0) {
    return {
      score: 0,
      detail: "No attendance history yet",
      available: false,
    };
  }

  return {
    score: clampScore(attendance.progressPercent),
    detail: `${attendance.eventsAttended} attended · ${attendance.eventsMissed} missed`,
    available: true,
  };
}

function activityScoreFromItems(
  items: MemberActivityItem[] | null | undefined,
): { score: number; detail: string; available: boolean } {
  if (!items || items.length === 0) {
    return {
      score: 0,
      detail: "No recent milestones yet",
      available: false,
    };
  }

  // Soft engagement curve: a handful of recent items reads healthy.
  const score = clampScore(35 + items.length * 12);
  return {
    score,
    detail:
      items.length === 1
        ? "1 recent update"
        : `${items.length} recent updates`,
    available: true,
  };
}

function countTrailingMisses(
  records: MemberAttendanceRecord[] | undefined,
  recent: MemberAttendanceRecord[] | undefined,
): number {
  const source =
    recent && recent.length > 0
      ? recent
      : records
        ? [...records].sort(
            (a, b) =>
              new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
          )
        : [];

  let misses = 0;
  for (const record of source) {
    if (record.status === "missed") {
      misses += 1;
      continue;
    }
    if (record.status === "attended") {
      break;
    }
  }
  return misses;
}

export function buildMemberHealthSuggestions(input: {
  trailingMisses: number;
  outstandingDues: boolean;
  leadershipEligible: boolean;
  band: MemberHealthBand;
  attendanceAvailable: boolean;
  paymentAvailable: boolean;
}): MemberHealthSuggestion[] {
  const suggestions: MemberHealthSuggestion[] = [];

  if (input.trailingMisses >= 3) {
    suggestions.push({
      id: "missed-events",
      text: "Missed last three events.",
      tone: "attention",
    });
  } else if (input.trailingMisses === 2) {
    suggestions.push({
      id: "missed-two",
      text: "Missed the last two events.",
      tone: "attention",
    });
  }

  if (input.outstandingDues) {
    suggestions.push({
      id: "outstanding-dues",
      text: "Outstanding dues.",
      tone: "risk",
    });
  }

  if (input.leadershipEligible) {
    suggestions.push({
      id: "leadership",
      text: "Eligible for leadership.",
      tone: "opportunity",
    });
  }

  if (input.band === "excellent" && suggestions.length === 0) {
    suggestions.push({
      id: "strong-health",
      text: "Engagement looks strong — keep momentum going.",
      tone: "positive",
    });
  }

  if (input.band === "at_risk" && suggestions.length < 2) {
    suggestions.push({
      id: "check-in",
      text: "Schedule a friendly check-in before the next meeting.",
      tone: "risk",
    });
  }

  // Placeholders when we have little real signal — still show useful coaching copy.
  if (suggestions.length === 0) {
    if (!input.attendanceAvailable) {
      suggestions.push({
        id: "track-attendance",
        text: "Attendance history will refine this score after the next events.",
        tone: "positive",
      });
    }
    if (!input.paymentAvailable) {
      suggestions.push({
        id: "dues-pending",
        text: "Dues status will appear once semester payments are recorded.",
        tone: "attention",
      });
    }
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "steady",
      text: "Health looks steady — no urgent follow-ups right now.",
      tone: "positive",
    });
  }

  return suggestions.slice(0, 4);
}

/**
 * Compute an overall member health snapshot for UI display.
 */
export function computeMemberHealth(
  input: MemberHealthInput = {},
): MemberHealthSnapshot {
  const attendanceSource = attendanceScoreFromSummary(input.attendance);
  const paymentSource = paymentScoreFromSummary(input.payments);
  const activitySource = activityScoreFromItems(input.activityItems);

  const taskAvailable =
    input.taskCompletionPercent !== null &&
    input.taskCompletionPercent !== undefined &&
    Number.isFinite(input.taskCompletionPercent);

  const placeholders = {
    attendance: clampScore(62 + seedUnit(input.memberId, 1) * 0.28),
    taskCompletion: clampScore(68 + seedUnit(input.memberId, 2) * 0.22),
    paymentStatus: clampScore(55 + seedUnit(input.memberId, 3) * 0.35),
    recentActivity: clampScore(58 + seedUnit(input.memberId, 4) * 0.3),
  };

  const attendanceScore = attendanceSource.available
    ? attendanceSource.score
    : placeholders.attendance;
  const taskScore = taskAvailable
    ? clampScore(input.taskCompletionPercent as number)
    : placeholders.taskCompletion;
  const paymentScore = paymentSource.available
    ? paymentSource.score
    : placeholders.paymentStatus;
  const activityScore = activitySource.available
    ? activitySource.score
    : placeholders.recentActivity;

  const factors: MemberHealthFactor[] = [
    {
      key: "attendance",
      label: "Attendance",
      score: attendanceScore,
      detail: attendanceSource.available
        ? attendanceSource.detail
        : "Placeholder · awaiting event history",
      available: attendanceSource.available,
    },
    {
      key: "taskCompletion",
      label: "Task Completion",
      score: taskScore,
      detail: taskAvailable
        ? `${clampScore(input.taskCompletionPercent as number)}% complete`
        : "Placeholder · no open tasks linked",
      available: taskAvailable,
    },
    {
      key: "paymentStatus",
      label: "Payment Status",
      score: paymentScore,
      detail: paymentSource.available
        ? paymentSource.detail
        : "Placeholder · awaiting dues records",
      available: paymentSource.available,
    },
    {
      key: "recentActivity",
      label: "Recent Activity",
      score: activityScore,
      detail: activitySource.available
        ? activitySource.detail
        : "Placeholder · timeline empty",
      available: activitySource.available,
    },
  ];

  const weighted =
    attendanceScore * WEIGHTS.attendance +
    taskScore * WEIGHTS.taskCompletion +
    paymentScore * WEIGHTS.paymentStatus +
    activityScore * WEIGHTS.recentActivity;

  const score = clampScore(weighted);
  const band = scoreToHealthBand(score);
  const trailingMisses = countTrailingMisses(
    input.attendanceRecords,
    input.attendance?.recent,
  );
  const outstandingDues = Boolean(
    input.payments?.hasRecords &&
      ((input.payments.outstandingAmount ?? 0) > 0 ||
        input.payments.paymentStatus === "unpaid" ||
        input.payments.paymentStatus === "partial"),
  );
  const leadershipEligible =
    score >= 78 &&
    attendanceScore >= 75 &&
    paymentScore >= 70 &&
    (input.role === "general" || input.role === "board" || !input.role);

  const usingPlaceholders = factors.some((factor) => !factor.available);

  return {
    score,
    band,
    bandLabel: memberHealthBandLabel(band),
    factors,
    suggestions: buildMemberHealthSuggestions({
      trailingMisses,
      outstandingDues,
      leadershipEligible,
      band,
      attendanceAvailable: attendanceSource.available,
      paymentAvailable: paymentSource.available,
    }),
    usingPlaceholders,
  };
}

/** Compact demo snapshot for list views when no factor data is loaded. */
export function placeholderMemberHealth(
  memberId?: number,
  role?: MemberRole | string,
): MemberHealthSnapshot {
  return computeMemberHealth({ memberId, role });
}
