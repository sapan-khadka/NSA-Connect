import { useMemo } from "react";

import {
  WEEKDAY_LABELS,
  addMonths,
  buildMonthGrid,
  formatMonthYear,
  isToday,
  toLocalIsoDate,
} from "../lib/calendar";
import { groupEventTypesByDate } from "../lib/calendar-events";
import type { CalendarEventInput } from "../lib/calendar-events";
import {
  EVENT_TYPE_DAY_CLASS,
  EVENT_TYPE_LABELS,
  EVENT_TYPES,
  getCalendarDayCellClass,
} from "../lib/event-types";

type MonthlyCalendarGridProps = {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  selectedDate?: string | null;
  onSelectDate?: (isoDate: string) => void;
  events?: CalendarEventInput[];
};

export function MonthlyCalendarGrid({
  year,
  month,
  onMonthChange,
  selectedDate = null,
  onSelectDate,
  events = [],
}: MonthlyCalendarGridProps) {
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const eventTypesByDate = useMemo(
    () => groupEventTypesByDate(events),
    [events],
  );
  const todayIso = toLocalIsoDate(new Date());

  function goToPreviousMonth() {
    const next = addMonths(year, month, -1);
    onMonthChange(next.year, next.month);
  }

  function goToNextMonth() {
    const next = addMonths(year, month, 1);
    onMonthChange(next.year, next.month);
  }

  function goToToday() {
    const today = new Date();
    onMonthChange(today.getFullYear(), today.getMonth());
    onSelectDate?.(todayIso);
  }

  return (
    <section
      aria-label={formatMonthYear(year, month)}
      className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-primary">
          {formatMonthYear(year, month)}
        </h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={goToPreviousMonth}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:border-accent hover:bg-accent/5"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:border-accent hover:bg-accent/5"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={goToNextMonth}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:border-accent hover:bg-accent/5"
          >
            Next
          </button>
        </div>
      </div>

      <ul
        aria-label="Event type legend"
        className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600"
      >
        {EVENT_TYPES.map((eventType) => (
          <li key={eventType} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-3 w-5 rounded-sm border border-black/5 ${EVENT_TYPE_DAY_CLASS[eventType]}`}
            />
            {EVENT_TYPE_LABELS[eventType]}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-gray-200 bg-gray-200">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-gray-50 px-1 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500"
          >
            {label}
          </div>
        ))}

        {cells.map((cell) => {
          const isSelected = selectedDate === cell.isoDate;
          const dayEventTypes = eventTypesByDate.get(cell.isoDate) ?? [];
          const cellIsToday = isToday(cell.date);
          const eventSummary =
            dayEventTypes.length > 0
              ? `, ${dayEventTypes.map((type) => EVENT_TYPE_LABELS[type]).join(", ")}`
              : "";

          return (
            <button
              key={cell.isoDate}
              type="button"
              aria-label={`${cell.isoDate}${eventSummary}`}
              aria-pressed={isSelected}
              onClick={() => onSelectDate?.(cell.isoDate)}
              className={[
                "relative flex min-h-16 flex-col items-center justify-center px-1 py-2 text-sm transition-colors sm:min-h-20",
                cell.isCurrentMonth ? "text-primary" : "text-gray-400",
                getCalendarDayCellClass(dayEventTypes, {
                  isSelected,
                  isCurrentMonth: cell.isCurrentMonth,
                }),
                cellIsToday && !isSelected ? "font-bold text-accent" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span>{cell.day}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
