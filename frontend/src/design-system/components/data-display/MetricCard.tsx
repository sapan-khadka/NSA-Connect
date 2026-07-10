import type { ReactNode } from "react";

import { cx } from "../../cx";
import { Card } from "../Card";
import { Skeleton } from "../Skeleton";

export type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  /** Secondary line (period, unit). */
  description?: ReactNode;
  /** Trend / delta chip. */
  trend?: ReactNode;
  trendTone?: "default" | "success" | "danger" | "warning";
  icon?: ReactNode;
  loading?: boolean;
  error?: ReactNode | null;
  className?: string;
};

const TREND_CLASS: Record<NonNullable<MetricCardProps["trendTone"]>, string> = {
  default: "text-label",
  success: "text-success",
  danger: "text-overdue",
  warning: "text-warning",
};

/**
 * KPI / metric tile with loading and error states.
 * Prefer this for analytics; use StatCard for simple dashboard counts.
 */
export function MetricCard({
  label,
  value,
  description,
  trend,
  trendTone = "default",
  icon,
  loading = false,
  error = null,
  className = "",
}: MetricCardProps) {
  return (
    <Card
      className={cx("flex h-full flex-col", className)}
      padding="md"
      aria-busy={loading || undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-label">{label}</p>
        {icon}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-overdue" role="alert">
          {error}
        </p>
      ) : loading ? (
        <div className="mt-4 space-y-3" aria-hidden="true">
          <Skeleton height={32} width="50%" />
          <Skeleton height={14} width="70%" />
        </div>
      ) : (
        <>
          <p className="mt-4 text-[32px] font-bold leading-none tracking-tight text-foreground">
            {value}
          </p>
          {(description || trend) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {description ? (
                <p className="text-sm text-label">{description}</p>
              ) : null}
              {trend ? (
                <p
                  className={cx(
                    "text-sm font-medium",
                    TREND_CLASS[trendTone],
                  )}
                >
                  {trend}
                </p>
              ) : null}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
