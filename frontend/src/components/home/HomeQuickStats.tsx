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

type OverviewMetric = {
  id: string;
  label: string;
  value: string;
  valueTone?: "default" | "negative" | "warning";
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
      valueTone: pendingMemberApprovals > 0 ? "warning" : "default",
      to: "/members",
    });
  } else {
    metrics.push({
      id: "my-tasks",
      label: "Open Tasks",
      value: String(tasksSummary.openCount),
      valueTone: tasksSummary.overdueCount > 0 ? "warning" : "default",
      to: "/events/tasks",
    });
  }

  metrics.push({
    id: "events",
    label: "Upcoming Events",
    value: isLoadingEvents ? "—" : String(upcomingEventCount),
    to: "/events/calendar",
  });

  if (canSeeTreasury) {
    const amount = treasuryBalance == null ? null : Number(treasuryBalance);
    const isNegative = amount != null && amount < 0;
    metrics.push({
      id: "treasury",
      label: "Treasury",
      value: treasuryBalance == null ? "—" : formatMoney(treasuryBalance),
      valueTone: isNegative ? "negative" : "default",
      to: FINANCE_PATH,
    });
  } else {
    metrics.push({
      id: "overdue",
      label: "Overdue",
      value: String(tasksSummary.overdueCount),
      valueTone: tasksSummary.overdueCount > 0 ? "warning" : "default",
      to: "/events/tasks",
    });
  }

  if (canSeeMembers || canSeeTreasury) {
    metrics.push({
      id: "pending",
      label: "Pending Items",
      value: String(pendingTotal),
      valueTone: pendingTotal > 0 ? "warning" : "default",
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
      label: "Due Today",
      value: String(tasksSummary.dueTodayCount),
      valueTone: tasksSummary.dueTodayCount > 0 ? "warning" : "default",
      to: "/events/tasks",
    });
  }

  return (
    <section
      className="home-org-overview"
      aria-label="Organization overview"
    >
      <header className="home-org-overview-head">
        <h2 className="home-org-overview-title">Organization Overview</h2>
      </header>
      <ul className="home-org-overview-list">
        {metrics.map((metric) => (
          <li key={metric.id}>
            <Link
              to={metric.to}
              className={[
                "home-org-overview-row",
                metric.valueTone === "negative"
                  ? "home-org-overview-row--negative"
                  : "",
                metric.valueTone === "warning"
                  ? "home-org-overview-row--warning"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="home-org-overview-row__label">
                {metric.label}
              </span>
              <span className="home-org-overview-row__value">
                {metric.value}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
