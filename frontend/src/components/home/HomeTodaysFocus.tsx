import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import type { MemberResponse } from "../../lib/auth-api";
import { eventDetailPath } from "../../lib/event-links";
import type { EventResponse } from "../../lib/events-api";
import { fetchFinanceSummary } from "../../lib/finance-api";
import { FINANCE_APPROVALS_PATH, FINANCE_PATH } from "../../lib/finance-routes";
import type { MyTasksSummary } from "../../lib/home-tasks";
import { fetchMeetings } from "../../lib/meetings-api";
import { meetingWorkspacePath } from "../../lib/meeting-workspace";
import {
  canManageMeetingRecords,
  canManageTreasury,
  canViewMemberDirectory,
} from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";

export type FocusItem = {
  id: string;
  label: string;
  detail: string;
  to: string;
  tone: "urgent" | "warn" | "info";
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function daysUntil(iso: string, now: Date): number | null {
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
}): FocusItem[] {
  const items: FocusItem[] = [];

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

  if (minutesMissing) {
    items.push({
      id: "minutes-missing",
      label: "Meeting minutes missing",
      detail: minutesMissing.name,
      to: meetingWorkspacePath(minutesMissing.eventId, "minutes"),
      tone: "warn",
    });
  }

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
  } else if (financeReviews > 0) {
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

  if (nextEvent) {
    const days = daysUntil(nextEvent.starts_at, now);
    if (days != null && days > 0) {
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

  return items.slice(0, 5);
}

export function HomeTodaysFocus({
  member,
  tasksSummary,
  tasksPath,
  pendingMemberApprovals,
  financePendingCount,
  nextEvent,
  isLoading,
}: {
  member: MemberResponse;
  tasksSummary: MyTasksSummary;
  tasksPath: string;
  pendingMemberApprovals: number;
  financePendingCount: number;
  nextEvent: EventResponse | null;
  isLoading?: boolean;
}) {
  const canReviewMembers = canViewMemberDirectory(member.role);
  const canReviewFinance = canManageTreasury(member.role, member.position);
  const canManageMinutes = canManageMeetingRecords(
    member.role,
    member.position,
  );
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
  const [minutesMissing, setMinutesMissing] = useState<{
    eventId: number;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!canReviewFinance) {
      setTreasuryBalance(null);
      return;
    }
    let cancelled = false;
    void fetchFinanceSummary()
      .then((summary) => {
        if (!cancelled) {
          const amount = Number(summary.balance);
          setTreasuryBalance(Number.isFinite(amount) ? amount : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTreasuryBalance(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canReviewFinance, member.id]);

  useEffect(() => {
    if (!canManageMinutes) {
      setMinutesMissing(null);
      return;
    }
    let cancelled = false;
    void fetchMeetings()
      .then((response) => {
        if (cancelled) {
          return;
        }
        const needsNotes = response.meetings.find(
          (meeting) => meeting.is_past && !meeting.has_minutes,
        );
        setMinutesMissing(
          needsNotes
            ? { eventId: needsNotes.event_id, name: needsNotes.event_name }
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setMinutesMissing(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canManageMinutes, member.id]);

  const items = useMemo(
    () =>
      buildTodaysFocusItems({
        tasksSummary,
        tasksPath,
        pendingMemberApprovals,
        financePendingCount,
        canReviewMembers,
        canReviewFinance,
        treasuryBalance,
        nextEvent,
        minutesMissing,
      }),
    [
      tasksSummary,
      tasksPath,
      pendingMemberApprovals,
      financePendingCount,
      canReviewMembers,
      canReviewFinance,
      treasuryBalance,
      nextEvent,
      minutesMissing,
    ],
  );

  return (
    <section className="home-focus" aria-label="Today's Focus">
      <div className="home-task-header">
        <h2 className="home-panel-title">Today&apos;s Focus</h2>
      </div>

      {isLoading ? (
        <p className="home-focus__empty">Loading…</p>
      ) : items.length === 0 ? (
        <p className="home-focus__empty">Nothing needs attention.</p>
      ) : (
        <ul className="home-focus__list">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.to}
                className={`home-focus__row is-${item.tone}`}
              >
                <span className="home-focus__dot" aria-hidden />
                <span className="home-focus__label">{item.label}</span>
                {item.detail ? (
                  <span className="home-focus__detail">{item.detail}</span>
                ) : (
                  <span className="home-focus__detail" aria-hidden />
                )}
                <AppIcon
                  icon={ChevronRight}
                  size="sm"
                  className="home-focus__chev"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
