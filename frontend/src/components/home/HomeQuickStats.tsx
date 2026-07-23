import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Users,
  UserCheck,
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

type StatTone = "teal" | "slate" | "amber" | "olive" | "sky";

type StatCard = {
  id: string;
  label: string;
  value: string;
  hint: string;
  hintTone?: "muted" | "positive" | "warning" | "negative";
  valueTone?: "default" | "negative";
  icon: typeof Users;
  tone: StatTone;
  to: string;
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

export function HomeQuickStats({
  member,
  upcomingEventCount,
  tasksSummary,
  pendingMemberApprovals,
  financePendingCount,
  isLoadingEvents,
  attendanceAvg = null,
}: {
  member: MemberResponse;
  upcomingEventCount: number;
  tasksSummary: MyTasksSummary;
  pendingMemberApprovals: number;
  financePendingCount: number;
  isLoadingEvents: boolean;
  /** Average attendance percent when available; otherwise shown as em dash. */
  attendanceAvg?: number | null;
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
    cards.push({
      id: "members",
      label: "Members",
      value: memberTotal == null ? "—" : String(memberTotal),
      hint:
        pendingMemberApprovals > 0
          ? `${pendingMemberApprovals} awaiting approval`
          : "Active roster",
      hintTone: pendingMemberApprovals > 0 ? "warning" : "positive",
      icon: Users,
      tone: "teal",
      to: "/members",
    });
  } else {
    cards.push({
      id: "my-tasks",
      label: "My tasks",
      value: String(tasksSummary.openCount),
      hint:
        tasksSummary.overdueCount > 0
          ? `${tasksSummary.overdueCount} overdue`
          : "Open assignments",
      hintTone: tasksSummary.overdueCount > 0 ? "warning" : "muted",
      icon: CheckCircle2,
      tone: "teal",
      to: "/events/tasks",
    });
  }

  cards.push({
    id: "events",
    label: "Events",
    value: isLoadingEvents ? "—" : String(upcomingEventCount),
    hint: upcomingEventCount === 1 ? "Upcoming event" : "Upcoming events",
    hintTone: "muted",
    icon: CalendarDays,
    tone: "slate",
    to: "/events/calendar",
  });

  if (canSeeTreasury) {
    const amount = treasuryBalance == null ? null : Number(treasuryBalance);
    cards.push({
      id: "treasury",
      label: "Treasury",
      value: treasuryBalance == null ? "—" : formatMoney(treasuryBalance),
      hint: "Available balance",
      hintTone: "muted",
      valueTone: amount != null && amount < 0 ? "negative" : "default",
      icon: CircleDollarSign,
      tone: "olive",
      to: FINANCE_PATH,
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
      tone: "olive",
      to: "/events/tasks",
    });
  }

  if (canSeeMembers || canSeeTreasury) {
    cards.push({
      id: "pending",
      label: "Pending approvals",
      value: String(pendingTotal),
      hint: pendingTotal > 0 ? "Requires action" : "No pending items",
      hintTone: pendingTotal > 0 ? "warning" : "muted",
      icon: CheckCircle2,
      tone: "amber",
      to:
        canSeeMembers && pendingMemberApprovals > 0
          ? "/members?tab=pending"
          : canSeeTreasury && financePendingCount > 0
            ? "/finance/approvals"
            : canSeeMembers
              ? "/members?tab=pending"
              : "/finance/approvals",
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
      tone: "amber",
      to: "/events/tasks",
    });
  }

  cards.push({
    id: "attendance",
    label: "Attendance",
    value:
      attendanceAvg == null || !Number.isFinite(attendanceAvg)
        ? "—"
        : `${Math.round(attendanceAvg)}%`,
    hint: attendanceAvg == null ? "Avg · no data yet" : "Average RSVP health",
    hintTone: "muted",
    icon: UserCheck,
    tone: "sky",
    to: "/events/calendar",
  });

  return (
    <section
      className="home-quick-stats home-quick-stats--strip home-quick-stats--kpi"
      aria-label="Quick stats"
    >
      <ul className="home-quick-stats-grid">
        {cards.map((card) => (
          <li key={card.id}>
            <Link
              to={card.to}
              className={["home-quick-stat", `home-quick-stat--${card.tone}`].join(
                " ",
              )}
            >
              <div className="home-quick-stat-top">
                <p className="home-quick-stat-label">{card.label}</p>
                <span className="home-quick-stat-icon" aria-hidden="true">
                  <AppIcon icon={card.icon} size="sm" className="text-current" />
                </span>
              </div>
              <p
                className={[
                  "home-quick-stat-value",
                  card.valueTone === "negative" ? "is-negative" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {card.value}
              </p>
              <p
                className={[
                  "home-quick-stat-hint",
                  card.hintTone === "positive" ? "is-positive" : "",
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
