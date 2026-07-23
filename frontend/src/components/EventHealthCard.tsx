/**
 * Presentational Event Health module — Preparation / Budget / Volunteers progress.
 * Counts and percents are computed by the parent; this component only renders.
 * Uses nested Card chrome so it sits inside the sidebar shell without stacking shadows.
 */

import { formatCurrency } from "../lib/format-currency";
import { Card } from "./ui/Card";

export type EventHealthCardProps = {
  preparationPct: number;
  budgetSpent: number;
  budgetCap: number;
  volunteersFilled: number;
  volunteersNeeded: number;
  /** False when the board has not set volunteer role spots yet. */
  volunteersTargetSet?: boolean;
  /** Hide the card title when nested under a disclosure summary. */
  showHeading?: boolean;
  className?: string;
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

function HealthRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent: number;
}) {
  const width = clampPercent(percent);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <p className="shrink-0 text-[12px] font-medium tabular-nums text-label">
          {value}
        </p>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(width)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function EventHealthCard({
  preparationPct,
  budgetSpent,
  budgetCap,
  volunteersFilled,
  volunteersNeeded,
  volunteersTargetSet = true,
  showHeading = true,
  className = "",
}: EventHealthCardProps) {
  const preparationValue = `${Math.round(clampPercent(preparationPct))}%`;
  const budgetValue = `${formatCurrency(budgetSpent)} / ${formatCurrency(budgetCap)}`;
  const volunteersValue = volunteersTargetSet
    ? `${volunteersFilled} / ${volunteersNeeded}`
    : "Not set";

  return (
    <Card
      nested
      padding="none"
      className={["space-y-3 p-3", className].filter(Boolean).join(" ")}
      aria-label="Event Health"
    >
      {showHeading ? (
        <h3 className="text-[12px] font-semibold tracking-tight text-foreground">
          Event Health
        </h3>
      ) : null}

      <div className="space-y-3">
        <HealthRow
          label="Preparation"
          value={preparationValue}
          percent={preparationPct}
        />
        <HealthRow
          label="Budget"
          value={budgetValue}
          percent={ratioPercent(budgetSpent, budgetCap)}
        />
        <HealthRow
          label="Volunteers"
          value={volunteersValue}
          percent={
            volunteersTargetSet
              ? ratioPercent(volunteersFilled, volunteersNeeded)
              : 0
          }
        />
      </div>
    </Card>
  );
}
