import { AlertTriangle, Check, Circle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import type { MemberResponse } from "../../lib/auth-api";
import type { EventResponse } from "../../lib/events-api";
import { fetchFinanceSummary } from "../../lib/finance-api";
import { FINANCE_PATH } from "../../lib/finance-routes";
import type { MyTasksSummary } from "../../lib/home-tasks";
import { fetchMembers } from "../../lib/members-api";
import {
  canManageTreasury,
  canViewMemberDirectory,
} from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";

type HealthLevel = "healthy" | "attention" | "critical";

type StatusFact = {
  id: string;
  text: string;
  tone: "ok" | "warn" | "danger" | "neutral";
  to: string;
};

type AttentionItem = {
  id: string;
  text: string;
  to: string;
  tone: "warn" | "danger";
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

function healthCopy(level: HealthLevel): string {
  if (level === "critical") {
    return "Needs attention";
  }
  if (level === "attention") {
    return "Needs a look";
  }
  return "Healthy";
}

export function HomeQuickStats({
  member,
  upcomingEvents,
  tasksSummary,
  pendingMemberApprovals,
  financePendingCount,
  isLoadingEvents,
  density = "lg",
}: {
  member: MemberResponse;
  upcomingEvents: EventResponse[];
  tasksSummary: MyTasksSummary;
  pendingMemberApprovals: number;
  financePendingCount: number;
  isLoadingEvents: boolean;
  density?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  const canSeeMembers = canViewMemberDirectory(member.role);
  const canSeeTreasury = canManageTreasury(member.role, member.position);
  const [memberTotal, setMemberTotal] = useState<number | null>(null);
  const [treasuryBalance, setTreasuryBalance] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const loads: Promise<void>[] = [];

    if (canSeeMembers) {
      loads.push(
        fetchMembers({ limit: 1 })
          .then((response) => {
            if (!cancelled) {
              setMemberTotal(response.total);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setMemberTotal(null);
            }
          }),
      );
    }

    if (canSeeTreasury) {
      loads.push(
        fetchFinanceSummary()
          .then((summary) => {
            if (!cancelled) {
              setTreasuryBalance(summary.balance);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setTreasuryBalance(null);
            }
          }),
      );
    }

    void Promise.all(loads).then(() => {
      if (!cancelled) {
        setLoadedAt(Date.now());
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canSeeMembers, canSeeTreasury, member.id]);

  const upcomingEventCount = upcomingEvents.length;
  const pendingTotal =
    (canSeeMembers ? pendingMemberApprovals : 0) +
    (canSeeTreasury ? financePendingCount : 0);
  const treasuryAmount =
    treasuryBalance == null ? null : Number(treasuryBalance);
  const treasuryNegative =
    treasuryAmount != null && Number.isFinite(treasuryAmount) && treasuryAmount < 0;

  const { health, facts, attention } = useMemo(() => {
    const nextFacts: StatusFact[] = [];
    const nextAttention: AttentionItem[] = [];
    let level: HealthLevel = "healthy";

    if (canSeeMembers) {
      nextFacts.push({
        id: "members",
        text:
          memberTotal == null
            ? "Members loading…"
            : `${memberTotal} active member${memberTotal === 1 ? "" : "s"}`,
        tone: "ok",
        to: "/members",
      });
    } else {
      const open = tasksSummary.openCount;
      nextFacts.push({
        id: "tasks",
        text: `${open} open task${open === 1 ? "" : "s"}`,
        tone: tasksSummary.overdueCount > 0 ? "warn" : "ok",
        to: "/events/tasks",
      });
      if (tasksSummary.overdueCount > 0) {
        level = "attention";
        nextAttention.push({
          id: "overdue",
          text: `${tasksSummary.overdueCount} overdue task${
            tasksSummary.overdueCount === 1 ? "" : "s"
          }`,
          to: "/events/tasks",
          tone: "warn",
        });
      }
    }

    nextFacts.push({
      id: "events",
      text: isLoadingEvents
        ? "Events loading…"
        : upcomingEventCount === 0
          ? "No upcoming events"
          : `${upcomingEventCount} upcoming event${
              upcomingEventCount === 1 ? "" : "s"
            }`,
      tone: "neutral",
      to: "/events/calendar",
    });

    if (canSeeMembers || canSeeTreasury) {
      if (pendingTotal > 0) {
        level = level === "critical" ? "critical" : "attention";
        nextAttention.push({
          id: "pending",
          text: `${pendingTotal} pending request${
            pendingTotal === 1 ? "" : "s"
          }`,
          to:
            canSeeMembers && pendingMemberApprovals > 0
              ? "/members?tab=pending"
              : canSeeTreasury && financePendingCount > 0
                ? "/finance/approvals"
                : canSeeMembers
                  ? "/members?tab=pending"
                  : "/finance/approvals",
          tone: "warn",
        });
      } else {
        nextFacts.push({
          id: "pending",
          text: "No pending approvals",
          tone: "ok",
          to: canSeeMembers ? "/members?tab=pending" : "/finance/approvals",
        });
      }
    } else if (tasksSummary.dueTodayCount > 0) {
      nextFacts.push({
        id: "due-today",
        text: `${tasksSummary.dueTodayCount} due today`,
        tone: "warn",
        to: "/events/tasks",
      });
    }

    if (canSeeTreasury && treasuryBalance != null) {
      if (treasuryNegative) {
        level = "critical";
        nextAttention.push({
          id: "treasury",
          text: `Treasury is negative · ${formatMoney(treasuryBalance)}`,
          to: FINANCE_PATH,
          tone: "danger",
        });
      } else {
        nextFacts.push({
          id: "treasury",
          text: `Treasury ${formatMoney(treasuryBalance)}`,
          tone: "ok",
          to: FINANCE_PATH,
        });
      }
    }

    return { health: level, facts: nextFacts, attention: nextAttention };
  }, [
    canSeeMembers,
    canSeeTreasury,
    financePendingCount,
    isLoadingEvents,
    memberTotal,
    pendingMemberApprovals,
    pendingTotal,
    tasksSummary.dueTodayCount,
    tasksSummary.openCount,
    tasksSummary.overdueCount,
    treasuryBalance,
    treasuryNegative,
    upcomingEventCount,
  ]);

  const showFooter = density !== "xs";
  const showFacts = density !== "xs";
  const compactFacts =
    density === "sm" ? facts.slice(0, 3) : facts.slice(0, 4);

  const updatedLabel = (() => {
    const mins = Math.max(0, Math.round((Date.now() - loadedAt) / 60000));
    if (mins < 1) {
      return "Updated just now";
    }
    if (mins === 1) {
      return "Updated 1 min ago";
    }
    return `Updated ${mins} min ago`;
  })();

  return (
    <section
      className={[
        "home-org-status",
        `home-org-status--${health}`,
      ].join(" ")}
      aria-label="Organization overview"
    >
      <header className="home-org-status__head">
        <p className="home-org-status__eyebrow">Organization</p>
        <div className="home-org-status__health">
          <span
            className={[
              "home-org-status__dot",
              `home-org-status__dot--${health}`,
            ].join(" ")}
            aria-hidden="true"
          />
          <h2 className="home-org-status__title">{healthCopy(health)}</h2>
        </div>
      </header>

      {showFacts ? (
        <ul className="home-org-status__facts">
          {compactFacts.map((fact) => (
            <li key={fact.id}>
              <Link
                to={fact.to}
                className={[
                  "home-org-status__fact",
                  `home-org-status__fact--${fact.tone}`,
                ].join(" ")}
              >
                <span className="home-org-status__fact-mark" aria-hidden="true">
                  <AppIcon
                    icon={fact.tone === "ok" ? Check : Circle}
                    size="sm"
                    className="text-current"
                  />
                </span>
                <span>{fact.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {attention.length > 0 ? (
        <div className="home-org-status__attention">
          {attention.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className={[
                "home-org-status__alert",
                `home-org-status__alert--${item.tone}`,
              ].join(" ")}
            >
              <AppIcon
                icon={AlertTriangle}
                size="sm"
                className="text-current"
              />
              <span>{item.text}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {showFooter ? (
        <p className="home-org-status__footer">{updatedLabel}</p>
      ) : null}
    </section>
  );
}
