/**
 * Compact event health summary for the calendar sidebar —
 * overall status badge, thin progress metrics, and a next action.
 */

import { Link } from "react-router";

import {
  computeEventHealth,
  type EventHealthLevel,
} from "../lib/event-health";
import { formatCurrency } from "../lib/format-currency";
import {
  EventNeedsAttentionCard,
  type NeedsAttentionItem,
} from "./EventNeedsAttentionCard";

export type EventHealthCardProps = {
  preparationPct: number;
  checklistDone: number;
  checklistTotal: number;
  overdueTasks?: number;
  budgetSpent: number;
  budgetCap: number;
  volunteersFilled: number;
  volunteersNeeded: number;
  /** False when the board has not set volunteer role spots yet. */
  volunteersTargetSet?: boolean;
  attentionItems?: NeedsAttentionItem[];
  /** Manage deep-link for Review / next-action CTA. */
  manageHref?: string | null;
  /** Hide the card title when nested under a disclosure summary. */
  showHeading?: boolean;
  className?: string;
};

const BADGE_CLASS: Record<EventHealthLevel, string> = {
  excellent: "event-health-badge event-health-badge--excellent",
  on_track: "event-health-badge event-health-badge--on-track",
  needs_attention: "event-health-badge event-health-badge--needs-attention",
  at_risk: "event-health-badge event-health-badge--at-risk",
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function ratioPercent(filled: number, total: number): number {
  if (!Number.isFinite(filled) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return clampPercent((filled / total) * 100);
}

function MetricRow({
  label,
  value,
  percent,
  showBar = false,
}: {
  label: string;
  value: string;
  percent?: number;
  showBar?: boolean;
}) {
  const width = clampPercent(percent ?? 0);

  return (
    <div className="event-health-metric">
      <div className="event-health-metric__header">
        <p className="event-health-metric__label">{label}</p>
        <p className="event-health-metric__value">{value}</p>
      </div>
      {showBar ? (
        <div
          className="event-health-metric__bar"
          role="progressbar"
          aria-label={label}
          aria-valuenow={Math.round(width)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="event-health-metric__bar-fill"
            style={{ width: `${width}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function EventHealthBadgePill({
  level,
  label,
}: {
  level: EventHealthLevel;
  label: string;
}) {
  return (
    <span className={BADGE_CLASS[level]}>
      <span className="event-health-badge__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function EventHealthCard({
  preparationPct,
  checklistDone,
  checklistTotal,
  overdueTasks = 0,
  budgetSpent,
  budgetCap,
  volunteersFilled,
  volunteersNeeded,
  volunteersTargetSet = true,
  attentionItems = [],
  manageHref = null,
  showHeading = true,
  className = "",
}: EventHealthCardProps) {
  const health = computeEventHealth({
    preparationPct,
    checklistDone,
    checklistTotal,
    overdueTasks,
    budgetSpent,
    budgetCap,
    volunteersFilled,
    volunteersNeeded,
    volunteersTargetSet,
  });

  const preparationValue = `${Math.round(clampPercent(preparationPct))}%`;
  const budgetValue =
    budgetCap > 0
      ? `${formatCurrency(budgetSpent)} / ${formatCurrency(budgetCap)}`
      : "No budget set";
  const volunteersValue = volunteersTargetSet
    ? `${volunteersFilled} / ${volunteersNeeded} assigned`
    : "Needs volunteer targets";
  const checklistValue =
    checklistTotal > 0
      ? `${checklistDone} / ${checklistTotal} complete`
      : "No tasks yet";

  const reviewLabel = attentionItems.some((item) => item.id === "overdue-tasks")
    ? "Review tasks"
    : attentionItems.length > 0
      ? "Review"
      : null;

  return (
    <div
      className={["event-health-summary", className].filter(Boolean).join(" ")}
      aria-label="Event Health"
    >
      {showHeading ? (
        <div className="event-health-summary__header">
          <h3 className="event-health-summary__title">Event Health</h3>
          <EventHealthBadgePill level={health.level} label={health.label} />
        </div>
      ) : null}

      <div className="event-health-summary__metrics">
        <MetricRow
          label="Preparation"
          value={preparationValue}
          percent={preparationPct}
          showBar
        />
        <MetricRow
          label="Budget"
          value={budgetValue}
          percent={budgetCap > 0 ? ratioPercent(budgetSpent, budgetCap) : 0}
          showBar={budgetCap > 0}
        />
        <MetricRow label="Volunteers" value={volunteersValue} />
        <MetricRow label="Checklist" value={checklistValue} />
      </div>

      <div className="event-health-summary__footer">
        {attentionItems.length > 0 ? (
          <>
            <EventNeedsAttentionCard
              items={attentionItems}
              className="event-health-attention border-0 bg-transparent p-0 shadow-none"
            />
            {manageHref && reviewLabel ? (
              <Link to={manageHref} className="event-health-summary__action">
                {reviewLabel}
                <span aria-hidden="true"> →</span>
              </Link>
            ) : null}
          </>
        ) : (
          <div className="event-health-summary__ok">
            <p className="event-health-summary__ok-title">Event is on track</p>
            {health.nextMilestone ? (
              <p className="event-health-summary__ok-next">
                Next: {health.nextMilestone}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
