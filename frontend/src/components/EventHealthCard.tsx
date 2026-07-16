/**
 * Presentational Event Health card — Preparation / Budget / Volunteers progress.
 * Counts and percents are computed by the parent; this component only renders.
 */

import { formatCurrency } from "../lib/format-currency";
import { HomeCard } from "./ui/HomeCard";

export type EventHealthCardProps = {
  preparationPct: number;
  budgetSpent: number;
  budgetCap: number;
  volunteersFilled: number;
  volunteersNeeded: number;
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
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="shrink-0 text-xs font-medium tabular-nums text-label">
          {value}
        </p>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-gray-100"
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
  className = "",
}: EventHealthCardProps) {
  const preparationValue = `${Math.round(clampPercent(preparationPct))}%`;
  const budgetValue = `${formatCurrency(budgetSpent)} / ${formatCurrency(budgetCap)}`;
  const volunteersValue = `${volunteersFilled} / ${volunteersNeeded}`;

  return (
    <HomeCard
      padding="sm"
      className={["space-y-4", className].filter(Boolean).join(" ")}
      aria-label="Event Health"
    >
      <h3 className="text-sm font-semibold text-foreground">Event Health</h3>

      <div className="space-y-3.5">
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
          percent={ratioPercent(volunteersFilled, volunteersNeeded)}
        />
      </div>
    </HomeCard>
  );
}
