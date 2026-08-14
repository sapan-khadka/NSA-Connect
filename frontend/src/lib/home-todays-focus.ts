/**
 * Today's Focus — Home action queue for chapter officers and members.
 *
 * Product model
 * ─────────────
 * What belongs here: open work that needs *someone's* attention right now,
 * scoped by role (treasury deficit only for finance managers, minutes only
 * for people who can manage meetings, etc.).
 *
 * How long items stay: only while the condition is true. There is no fixed TTL.
 * Resolve the underlying work → the row disappears on the next refresh.
 *
 * How items are replaced: ranked by urgency each time the page loads; when a
 * new higher-priority need appears it slots above weaker ones. Soft items
 * (event countdown) drop off when outside the horizon. Cap at FOCUS_MAX_ITEMS.
 *
 * Not for: historical logs, vanity stats, or events already covered solely by
 * the hero (distant events stay out of Focus).
 */

import type { EventResponse } from "./events-api";
import type { MyTasksSummary } from "./home-tasks";
import {
  FINANCE_APPROVALS_PATH,
  FINANCE_PATH,
} from "./finance-routes";
import type { MeetingSummary } from "./meetings-api";
import { meetingWorkspacePath } from "./meeting-workspace";
import { eventDetailPath } from "./event-links";

/** Hard cap so Focus stays scannable in one glance. */
export const FOCUS_MAX_ITEMS = 5;

/**
 * Only surface an upcoming event countdown when it starts within this many days.
 * Far-out cultural events stay in the hero / calendar, not the action list.
 */
export const FOCUS_NEXT_EVENT_HORIZON_DAYS = 14;

/**
 * Only flag missing minutes for past meetings held within this many days.
 * Year-old gaps are documentation debt, not "today's" work.
 */
export const FOCUS_MINUTES_LOOKBACK_DAYS = 28;

export type FocusTone = "urgent" | "warn" | "info";

export type FocusItem = {
  id: string;
  label: string;
  detail: string;
  to: string;
  tone: FocusTone;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function daysUntil(iso: string, now: Date): number | null {
  const start = new Date(iso).getTime();
  if (!Number.isFinite(start)) {
    return null;
  }
  const diff = start - now.getTime();
  if (diff <= 0) {
    return 0;
  }
  return Math.ceil(diff / 86_400_000);
}

/** Most recent past meeting without minutes still inside the lookback window. */
export function pickMinutesMissingMeeting(
  meetings: MeetingSummary[],
  now: Date = new Date(),
  lookbackDays: number = FOCUS_MINUTES_LOOKBACK_DAYS,
): { eventId: number; name: string } | null {
  const cutoff = now.getTime() - lookbackDays * 86_400_000;
  const candidates = meetings
    .filter((meeting) => meeting.is_past && !meeting.has_minutes)
    .filter((meeting) => {
      const starts = new Date(meeting.starts_at).getTime();
      return Number.isFinite(starts) && starts >= cutoff;
    })
    .sort(
      (a, b) =>
        new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
    );

  const first = candidates[0];
  if (!first) {
    return null;
  }
  return { eventId: first.event_id, name: first.event_name };
}

/**
 * Ranked action list. Order is intentional (urgent → warn → near-term info).
 * Callers pass **current** state only — this is not an event log.
 */
export function buildTodaysFocusItems({
  tasksSummary,
  tasksPath,
  pendingMemberApprovals,
  financePendingCount,
  canReviewMembers,
  canReviewFinance,
  treasuryBalance,
  nextEvent = null,
  minutesMissing = null,
  now = new Date(),
  maxItems = FOCUS_MAX_ITEMS,
  eventHorizonDays = FOCUS_NEXT_EVENT_HORIZON_DAYS,
}: {
  tasksSummary: MyTasksSummary;
  tasksPath: string;
  pendingMemberApprovals: number;
  financePendingCount: number;
  canReviewMembers: boolean;
  canReviewFinance: boolean;
  treasuryBalance: number | null;
  nextEvent?: EventResponse | null;
  minutesMissing?: { eventId: number; name: string } | null;
  now?: Date;
  maxItems?: number;
  eventHorizonDays?: number;
}): FocusItem[] {
  const items: FocusItem[] = [];

  // 1. Treasury — balance only visible and actionable for finance roles.
  if (
    canReviewFinance &&
    treasuryBalance != null &&
    Number.isFinite(treasuryBalance) &&
    treasuryBalance < 0
  ) {
    items.push({
      id: "budget-deficit",
      label: "Budget deficit",
      detail: formatMoney(treasuryBalance),
      to: FINANCE_PATH,
      tone: "urgent",
    });
  }

  // 2–3. Your open task work (personal or path already role-scoped upstream).
  if (tasksSummary.overdueCount > 0) {
    items.push({
      id: "overdue",
      label:
        tasksSummary.overdueCount === 1
          ? "1 task overdue"
          : `${tasksSummary.overdueCount} tasks overdue`,
      detail: "Needs attention today",
      to: tasksPath,
      tone: "urgent",
    });
  }

  if (tasksSummary.dueTodayCount > 0) {
    items.push({
      id: "due-today",
      label:
        tasksSummary.dueTodayCount === 1
          ? "1 task due today"
          : `${tasksSummary.dueTodayCount} tasks due today`,
      detail: "Finish before end of day",
      to: tasksPath,
      tone: "warn",
    });
  }

  // 4. Chapter records — secretary / board with meeting access.
  if (minutesMissing) {
    items.push({
      id: "minutes-missing",
      label: "Meeting minutes missing",
      detail: minutesMissing.name,
      to: meetingWorkspacePath(minutesMissing.eventId, "minutes"),
      tone: "warn",
    });
  }

  // 5–6. Approvals (both can appear — different queues).
  const memberReviews = canReviewMembers ? pendingMemberApprovals : 0;
  const financeReviews = canReviewFinance ? financePendingCount : 0;

  if (memberReviews > 0) {
    items.push({
      id: "member-reviews",
      label:
        memberReviews === 1
          ? "1 pending approval"
          : `${memberReviews} pending approvals`,
      detail: "Members awaiting approval",
      to: "/members?tab=pending",
      tone: "warn",
    });
  }

  if (financeReviews > 0) {
    items.push({
      id: "finance-reviews",
      label:
        financeReviews === 1
          ? "1 finance review"
          : `${financeReviews} finance reviews`,
      detail: "Approvals waiting",
      to: FINANCE_APPROVALS_PATH,
      tone: "warn",
    });
  }

  // 7. Near-term event only — day-of and far-out stay out.
  if (nextEvent) {
    const days = daysUntil(nextEvent.starts_at, now);
    if (days != null && days >= 1 && days <= eventHorizonDays) {
      items.push({
        id: "next-event",
        label:
          days === 1
            ? `${nextEvent.name} starts tomorrow`
            : `${nextEvent.name} starts in ${days} days`,
        detail: "Upcoming event",
        to: eventDetailPath(nextEvent.id),
        tone: "info",
      });
    }
  }

  return items.slice(0, maxItems);
}
