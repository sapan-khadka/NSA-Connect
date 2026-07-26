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

type OverviewMetric = {
  id: string;
  label: string;
  value: string;
  hint: string;
  valueTone?: "default" | "negative" | "warning";
  icon: typeof Users;
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

  const metrics: OverviewMetric[] = [];

  if (canSeeMembers) {
    metrics.push({
      id: "members",
      label: "Members",
      value: memberTotal == null ? "—" : String(memberTotal),
      hint:
        pendingMemberApprovals > 0
          ? `${pendingMemberApprovals} awaiting approval`
          : "Active roster",
      valueTone: pendingMemberApprovals > 0 ? "warning" : "default",
      icon: Users,
      to: "/members",
    });
  } else {
    metrics.push({
      id: "my-tasks",
      label: "My tasks",
      value: String(tasksSummary.openCount),
      hint:
        tasksSummary.overdueCount > 0
          ? `${tasksSummary.overdueCount} overdue`
          : "Open assignments",
      valueTone: tasksSummary.overdueCount > 0 ? "warning" : "default",
      icon: CheckCircle2,
      to: "/events/tasks",
    });
  }

  metrics.push({
    id: "events",
    label: "Events",
    value: isLoadingEvents ? "—" : String(upcomingEventCount),
    hint: upcomingEventCount === 1 ? "Upcoming event" : "Upcoming events",
    icon: CalendarDays,
    to: "/events/calendar",
  });

  if (canSeeTreasury) {
    const amount = treasuryBalance == null ? null : Number(treasuryBalance);
    const isNegative = amount != null && amount < 0;
    metrics.push({
      id: "treasury",
      label: "Treasury",
      value: treasuryBalance == null ? "—" : formatMoney(treasuryBalance),
      hint: isNegative ? "Balance is negative" : "Available balance",
      valueTone: isNegative ? "negative" : "default",
      icon: CircleDollarSign,
      to: FINANCE_PATH,
    });
  } else {
    metrics.push({
      id: "overdue",
      label: "Overdue",
      value: String(tasksSummary.overdueCount),
      hint:
        tasksSummary.overdueCount > 0 ? "Needs attention" : "You’re caught up",
      valueTone: tasksSummary.overdueCount > 0 ? "warning" : "default",
      icon: CheckCircle2,
      to: "/events/tasks",
    });
  }

  if (canSeeMembers || canSeeTreasury) {
    metrics.push({
      id: "pending",
      label: "Pending",
      value: String(pendingTotal),
      hint: pendingTotal > 0 ? "Requires action" : "No pending items",
      valueTone: pendingTotal > 0 ? "warning" : "default",
      icon: Clock3,
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
    metrics.push({
      id: "due-today",
      label: "Due today",
      value: String(tasksSummary.dueTodayCount),
      hint:
        tasksSummary.dueTodayCount > 0
          ? "Focus here first"
          : "Nothing due today",
      valueTone: tasksSummary.dueTodayCount > 0 ? "warning" : "default",
      icon: CalendarDays,
      to: "/events/tasks",
    });
  }

  return (
    <section
      className="home-org-overview"
      aria-label="Organization overview"
    >
      <header className="home-org-overview-head">
        <h2 className="home-org-overview-title">Organization overview</h2>
        <p className="home-org-overview-sub">Live chapter pulse</p>
      </header>
      <ul className="home-org-overview-grid">
        {metrics.map((metric) => (
          <li key={metric.id}>
            <Link
              to={metric.to}
              className={[
                "home-org-overview-metric",
                metric.valueTone === "negative"
                  ? "home-org-overview-metric--negative"
                  : "",
                metric.valueTone === "warning"
                  ? "home-org-overview-metric--warning"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="home-org-overview-metric-value">
                {metric.value}
              </span>
              <span className="home-org-overview-metric-label">
                <AppIcon icon={metric.icon} size="xs" className="text-current" />
                {metric.label}
              </span>
              <span className="home-org-overview-metric-hint">{metric.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
