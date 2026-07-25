import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { MemberResponse } from "../../lib/auth-api";
import { fetchFinanceSummary } from "../../lib/finance-api";
import { FINANCE_PATH } from "../../lib/finance-routes";
import type { MyTasksSummary } from "../../lib/home-tasks";
import { fetchMembers } from "../../lib/members-api";
import {
  canManageTreasury,
  canViewMemberDirectory,
} from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";

type StatCard = {
  id: string;
  label: string;
  value: string;
  hint: string;
  hintTone?: "muted" | "positive" | "warning" | "negative";
  valueTone?: "default" | "negative";
  icon: typeof Users;
  to: string;
  /** 0–100 quiet progress under the number (DESIGN_SYSTEM.md §4). */
  progress: number;
  progressAtRisk?: boolean;
};

function formatMoney(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return value;
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function HomeQuickStats({
  member,
  upcomingEventCount,
  tasksSummary,
  pendingMemberApprovals,
  financePendingCount,
  isLoadingEvents,
}: {
  member: MemberResponse;
  upcomingEventCount: number;
  tasksSummary: MyTasksSummary;
  pendingMemberApprovals: number;
  financePendingCount: number;
  isLoadingEvents: boolean;
}) {
  const canSeeMembers = canViewMemberDirectory(member.role);
  const canSeeTreasury = canManageTreasury(member.role, member.position);
  const [memberTotal, setMemberTotal] = useState<number | null>(null);
  const [treasuryBalance, setTreasuryBalance] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (canSeeMembers) {
      void fetchMembers({ limit: 1 })
        .then((response) => {
          if (!cancelled) {
            setMemberTotal(response.total);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMemberTotal(null);
          }
        });
    }

    if (canSeeTreasury) {
      void fetchFinanceSummary()
        .then((summary) => {
          if (!cancelled) {
            setTreasuryBalance(summary.balance);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setTreasuryBalance(null);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [canSeeMembers, canSeeTreasury, member.id]);

  const pendingTotal =
    (canSeeMembers ? pendingMemberApprovals : 0) +
    (canSeeTreasury ? financePendingCount : 0);

  const cards: StatCard[] = [];

  if (canSeeMembers) {
    const total = memberTotal ?? 0;
    const pendingShare =
      total > 0 ? (pendingMemberApprovals / total) * 100 : 0;
    cards.push({
      id: "members",
      label: "Members",
      value: memberTotal == null ? "—" : String(memberTotal),
      hint:
        pendingMemberApprovals > 0
          ? `${pendingMemberApprovals} awaiting approval`
          : "Active roster",
      hintTone: pendingMemberApprovals > 0 ? "warning" : "muted",
      icon: Users,
      to: "/members",
      // Quiet fullness: roster present; at-risk fill when approvals pile up.
      progress:
        pendingMemberApprovals > 0
          ? clampProgress(Math.max(12, pendingShare))
          : clampProgress(total > 0 ? 72 : 8),
      progressAtRisk: pendingMemberApprovals > 0,
    });
  } else {
    const open = tasksSummary.openCount;
    const overdueShare =
      open > 0 ? (tasksSummary.overdueCount / open) * 100 : 0;
    cards.push({
      id: "my-tasks",
      label: "My tasks",
      value: String(open),
      hint:
        tasksSummary.overdueCount > 0
          ? `${tasksSummary.overdueCount} overdue`
          : "Open assignments",
      hintTone: tasksSummary.overdueCount > 0 ? "warning" : "muted",
      icon: CheckCircle2,
      to: "/events/tasks",
      progress:
        tasksSummary.overdueCount > 0
          ? clampProgress(Math.max(18, overdueShare))
          : clampProgress(open > 0 ? 55 : 8),
      progressAtRisk: tasksSummary.overdueCount > 0,
    });
  }

  cards.push({
    id: "events",
    label: "Events",
    value: isLoadingEvents ? "—" : String(upcomingEventCount),
    hint: upcomingEventCount === 1 ? "Upcoming event" : "Upcoming events",
    hintTone: "muted",
    icon: CalendarDays,
    to: "/events/calendar",
    progress: clampProgress(
      upcomingEventCount <= 0 ? 8 : Math.min(100, upcomingEventCount * 22),
    ),
  });

  if (canSeeTreasury) {
    const amount = treasuryBalance == null ? null : Number(treasuryBalance);
    const isNegative = amount != null && amount < 0;
    cards.push({
      id: "treasury",
      label: "Treasury",
      value: treasuryBalance == null ? "—" : formatMoney(treasuryBalance),
      hint: isNegative ? "Balance is negative" : "Available balance",
      hintTone: isNegative ? "warning" : "muted",
      valueTone: isNegative ? "negative" : "default",
      icon: CircleDollarSign,
      to: FINANCE_PATH,
      progress: isNegative
        ? 68
        : clampProgress(amount == null ? 8 : amount === 0 ? 20 : 64),
      progressAtRisk: isNegative,
    });
  } else {
    cards.push({
      id: "overdue",
      label: "Overdue",
      value: String(tasksSummary.overdueCount),
      hint:
        tasksSummary.overdueCount > 0 ? "Needs attention" : "You’re caught up",
      hintTone: tasksSummary.overdueCount > 0 ? "warning" : "positive",
      icon: CheckCircle2,
      to: "/events/tasks",
      progress: clampProgress(
        tasksSummary.overdueCount <= 0
          ? 10
          : Math.min(100, tasksSummary.overdueCount * 28),
      ),
      progressAtRisk: tasksSummary.overdueCount > 0,
    });
  }

  if (canSeeMembers || canSeeTreasury) {
    cards.push({
      id: "pending",
      label: "Pending",
      value: String(pendingTotal),
      hint: pendingTotal > 0 ? "Requires action" : "No pending items",
      hintTone: pendingTotal > 0 ? "warning" : "muted",
      icon: Clock3,
      to:
        canSeeMembers && pendingMemberApprovals > 0
          ? "/members?tab=pending"
          : canSeeTreasury && financePendingCount > 0
            ? "/finance/approvals"
            : canSeeMembers
              ? "/members?tab=pending"
              : "/finance/approvals",
      progress: clampProgress(
        pendingTotal <= 0 ? 10 : Math.min(100, pendingTotal * 24),
      ),
      progressAtRisk: pendingTotal > 0,
    });
  } else {
    cards.push({
      id: "due-today",
      label: "Due today",
      value: String(tasksSummary.dueTodayCount),
      hint:
        tasksSummary.dueTodayCount > 0 ? "Focus here first" : "Nothing due today",
      hintTone: tasksSummary.dueTodayCount > 0 ? "warning" : "muted",
      icon: CalendarDays,
      to: "/events/tasks",
      progress: clampProgress(
        tasksSummary.dueTodayCount <= 0
          ? 10
          : Math.min(100, tasksSummary.dueTodayCount * 30),
      ),
      progressAtRisk: tasksSummary.dueTodayCount > 0,
    });
  }

  return (
    <section
      className="home-quick-stats home-quick-stats--tiles home-quick-stats--kpi home-quick-stats--companion"
      aria-label="Quick stats"
    >
      <ul className="home-quick-stats-grid">
        {cards.map((card) => (
          <li key={card.id}>
            <Link
              to={card.to}
              className={[
                "home-quick-stat",
                card.valueTone === "negative" ? "home-quick-stat--negative" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="home-quick-stat-top">
                <p className="home-quick-stat-category">{card.label}</p>
                <span className="home-quick-stat-icon" aria-hidden="true">
                  <AppIcon icon={card.icon} size="xs" className="text-current" />
                </span>
              </div>
              <p className="home-quick-stat-value">{card.value}</p>
              <div
                className="home-quick-stat-progress"
                aria-hidden="true"
              >
                <span
                  className={[
                    "home-quick-stat-progress-fill",
                    card.progressAtRisk ? "is-risk" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ width: `${card.progress}%` }}
                />
              </div>
              <p
                className={[
                  "home-quick-stat-hint",
                  card.hintTone === "warning" ? "is-warning" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {card.hint}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
