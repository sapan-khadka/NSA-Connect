/**
 * Compact event health for the calendar sidebar — status, three metrics,
 * and a single next action. Board-only; Manage Event holds the full picture.
 */

import { ArrowLink } from "./ui/ArrowLink";
import {
  computeEventHealth,
  eventHealthManageHref,
} from "../lib/event-health";
import { formatCurrencyCompact } from "../lib/format-currency";

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
  manageEventId?: number | null;
  className?: string;
};

const EMPTY = "—";

function MetricCell({
  value,
  label,
  tone,
  empty = false,
}: {
  value: string;
  label: string;
  tone?: "warn" | "risk";
  empty?: boolean;
}) {
  return (
    <div className="event-command-metric">
      <p
        className={[
          "event-command-metric-value",
          empty ? "is-empty" : "",
          tone === "risk" ? "is-overdue" : "",
          tone === "warn" ? "is-warn" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </p>
      <span className="event-command-metric-label">{label}</span>
    </div>
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
  manageEventId = null,
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

  const budgetOverspent = budgetCap > 0 && budgetSpent > budgetCap;
  const volunteerGap =
    volunteersTargetSet && volunteersNeeded > volunteersFilled;
  const hasBudget = budgetCap > 0;
  const hasTasks = checklistTotal > 0;
  const manageHref =
    manageEventId != null
      ? eventHealthManageHref(manageEventId, health.action)
      : null;

  return (
    <section
      className={["event-health-summary", className].filter(Boolean).join(" ")}
      aria-label="Event health"
    >
      <div className="event-command-section-head">
        <h3 className="event-command-kicker">Health</h3>
        <p
          className={`event-command-status event-health-status is-${health.level.replaceAll("_", "-")}`}
        >
          {health.label}
        </p>
      </div>

      <div className="event-command-metrics">
        <MetricCell
          value={hasBudget ? formatCurrencyCompact(budgetSpent) : EMPTY}
          label="Budget"
          empty={!hasBudget}
          tone={budgetOverspent ? "risk" : undefined}
        />
        <MetricCell
          value={
            volunteersTargetSet
              ? `${volunteersFilled}/${volunteersNeeded}`
              : EMPTY
          }
          label="Volunteers"
          empty={!volunteersTargetSet}
          tone={volunteerGap ? "warn" : undefined}
        />
        <MetricCell
          value={hasTasks ? `${checklistDone}/${checklistTotal}` : EMPTY}
          label="Tasks"
          empty={!hasTasks}
          tone={overdueTasks > 0 ? "risk" : undefined}
        />
      </div>

      {health.nextMilestone ? (
        <div className="event-health-next">
          <span
            className={[
              "event-attention-mark",
              health.level === "at_risk" ? "is-fail" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
          />
          <p className="event-attention-label">{health.nextMilestone}</p>
          {manageHref ? <ArrowLink to={manageHref}>Review</ArrowLink> : null}
        </div>
      ) : null}
    </section>
  );
}
