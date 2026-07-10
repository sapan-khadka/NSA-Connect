import type { ReactNode } from "react";

import { cx } from "../../cx";
import { Card } from "../Card";
import { DataStatus } from "./DataStatus";
import { EmptyState } from "./EmptyState";

export type CalendarCardDay = {
  id: string;
  /** Day-of-month label or full date node. */
  label: ReactNode;
  /** ISO date string for accessibility, e.g. 2026-07-10. */
  date?: string;
  isToday?: boolean;
  isOutsideMonth?: boolean;
  isSelected?: boolean;
  hasEvents?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export type CalendarCardProps = {
  /** Month / range heading. */
  title: ReactNode;
  /** Weekday headers (defaults to Su–Sa). */
  weekdays?: ReactNode[];
  days?: CalendarCardDay[];
  /** Optional list below the grid (upcoming events). */
  footer?: ReactNode;
  headerActions?: ReactNode;
  loading?: boolean;
  error?: ReactNode | null;
  empty?: boolean;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  className?: string;
};

const DEFAULT_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Calendar month shell. Pass `days` (typically 42 cells) from the caller.
 */
export function CalendarCard({
  title,
  weekdays = DEFAULT_WEEKDAYS,
  days = [],
  footer,
  headerActions,
  loading = false,
  error = null,
  empty = false,
  emptyTitle = "No calendar data",
  emptyDescription = "Dates will appear when available.",
  className = "",
}: CalendarCardProps) {
  return (
    <Card className={cx("flex flex-col", className)} padding="md">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {headerActions}
      </div>

      <div className="mt-4">
        <DataStatus
          loading={loading}
          error={error}
          empty={empty || (!loading && !error && days.length === 0)}
          emptyFallback={
            <EmptyState title={emptyTitle} description={emptyDescription} />
          }
          minHeightClassName="min-h-48"
        >
          <div
            className="grid grid-cols-7 gap-1"
            role="grid"
            aria-label={typeof title === "string" ? title : "Calendar"}
          >
            {weekdays.map((day, index) => (
              <div
                key={index}
                role="columnheader"
                className="px-1 py-2 text-center text-xs font-semibold text-label"
              >
                {day}
              </div>
            ))}
            {days.map((day) => {
              const cellClass = cx(
                "relative flex h-10 items-center justify-center rounded-lg text-sm transition duration-200",
                day.isOutsideMonth ? "text-label/50" : "text-foreground",
                day.isToday ? "font-bold text-primary" : "",
                day.isSelected
                  ? "bg-primary text-white hover:bg-primary-hover"
                  : "hover:bg-surface-muted",
                day.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
              );

              return (
                <button
                  key={day.id}
                  type="button"
                  role="gridcell"
                  disabled={day.disabled}
                  aria-current={day.isToday ? "date" : undefined}
                  aria-selected={day.isSelected || undefined}
                  aria-label={day.date ?? undefined}
                  onClick={day.onClick}
                  className={cellClass}
                >
                  {day.label}
                  {day.hasEvents ? (
                    <span
                      aria-hidden="true"
                      className={cx(
                        "absolute bottom-1 h-1 w-1 rounded-full",
                        day.isSelected ? "bg-white" : "bg-primary",
                      )}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          {footer ? <div className="mt-4 border-t border-gray-200 pt-4">{footer}</div> : null}
        </DataStatus>
      </div>
    </Card>
  );
}
