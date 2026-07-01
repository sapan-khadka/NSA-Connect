import { useMemo, useState } from "react";

import {
  WEEKDAY_LABELS,
  addMonths,
  buildMonthGrid,
  formatMonthYear,
  isToday,
  toLocalIsoDate,
} from "../lib/calendar";
import { CalendarCoverHeader } from "./CalendarCoverHeader";
import {
  CalendarCategoryDots,
  getDayCellSurfaceClass,
  getMonthEnterAnimationClass,
  type MonthEnterDirection,
} from "./calendar-grid-utils";
import { groupEventTypesByDate } from "../lib/calendar-events";
import type { CalendarEventInput } from "../lib/calendar-events";
import {
  EVENT_TYPE_DOT_CLASS,
  EVENT_TYPE_LABELS,
  EVENT_TYPES,
  FESTIVAL_DOT_CLASS,
} from "../lib/event-types";
import { getFestivalsOnDate, toBikramSambat } from "../lib/nepali-calendar";

type MonthlyCalendarGridProps = {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  selectedDate?: string | null;
  onSelectDate?: (isoDate: string) => void;
  events?: CalendarEventInput[];
};

function CalendarLegendList({
  className,
  labelled = false,
}: {
  className: string;
  labelled?: boolean;
}) {
  return (
    <ul
      className={className}
      {...(labelled ? { "aria-label": "Event type legend" } : {})}
    >
      {EVENT_TYPES.map((eventType) => (
        <li key={eventType} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${EVENT_TYPE_DOT_CLASS[eventType]}`}
          />
          {EVENT_TYPE_LABELS[eventType]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${FESTIVAL_DOT_CLASS}`}
        />
        Nepali festival
      </li>
    </ul>
  );
}

export function MonthlyCalendarGrid({
  year,
  month,
  onMonthChange,
  selectedDate = null,
  onSelectDate,
  events = [],
}: MonthlyCalendarGridProps) {
  const [monthEnterDirection, setMonthEnterDirection] =
    useState<MonthEnterDirection>(null);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const eventTypesByDate = useMemo(
    () => groupEventTypesByDate(events),
    [events],
  );
  const todayIso = toLocalIsoDate(new Date());
  const monthAnimationClass = getMonthEnterAnimationClass(monthEnterDirection);

  function goToPreviousMonth() {
    setMonthEnterDirection("prev");
    const next = addMonths(year, month, -1);
    onMonthChange(next.year, next.month);
  }

  function goToNextMonth() {
    setMonthEnterDirection("next");
    const next = addMonths(year, month, 1);
    onMonthChange(next.year, next.month);
  }

  function goToToday() {
    const today = new Date();
    setMonthEnterDirection(null);
    onMonthChange(today.getFullYear(), today.getMonth());
    onSelectDate?.(todayIso);
  }

  return (
    <section
      aria-label={formatMonthYear(year, month)}
      className="ds-card p-3 sm:p-4"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <p
          data-testid="calendar-month-label"
          className="text-base font-medium text-foreground"
        >
          {formatMonthYear(year, month)}
        </p>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={goToPreviousMonth}
            className="rounded-lg border border-surface-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-surface-muted dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800 sm:px-3 sm:py-1.5 sm:text-sm"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-lg border border-surface-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-surface-muted dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800 sm:px-3 sm:py-1.5 sm:text-sm"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={goToNextMonth}
            className="rounded-lg border border-surface-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-surface-muted dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800 sm:px-3 sm:py-1.5 sm:text-sm"
          >
            Next
          </button>
        </div>
      </div>

      <CalendarCoverHeader />

      <details className="mb-2 lg:hidden">
        <summary className="cursor-pointer text-[11px] font-medium text-label dark:text-label">
          Calendar legend
        </summary>
        <CalendarLegendList className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-label dark:text-label" />
      </details>

      <CalendarLegendList
        labelled
        className="mb-2 hidden flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-label dark:text-label lg:flex"
      />

      <div
        key={`${year}-${month}`}
        className={["grid grid-cols-7 gap-1", monthAnimationClass].join(" ")}
        data-testid="calendar-month-grid"
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-0.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-label dark:text-label sm:text-[11px]"
          >
            {label}
          </div>
        ))}

        {cells.map((cell) => {
          const isSelected = selectedDate === cell.isoDate;
          const dayEventTypes = eventTypesByDate.get(cell.isoDate) ?? [];
          const festivals = getFestivalsOnDate(cell.isoDate);
          const cellIsToday = isToday(cell.date);
          const eventSummary =
            dayEventTypes.length > 0
              ? `, ${dayEventTypes.map((type) => EVENT_TYPE_LABELS[type]).join(", ")}`
              : "";
          const festivalSummary =
            festivals.length > 0
              ? `, ${festivals.map((festival) => festival.name).join(", ")}`
              : "";
          const bsLabel = cell.isCurrentMonth ? toBikramSambat(cell.isoDate) : null;

          return (
            <button
              key={cell.isoDate}
              type="button"
              data-testid="calendar-day-cell"
              aria-label={`${cell.isoDate}${eventSummary}${festivalSummary}`}
              aria-pressed={isSelected}
              onClick={() => onSelectDate?.(cell.isoDate)}
              className={getDayCellSurfaceClass({
                isCurrentMonth: cell.isCurrentMonth,
                isSelected,
                isToday: cellIsToday,
              })}
            >
              <span className={cellIsToday && !isSelected ? "font-semibold" : ""}>
                {cell.day}
              </span>
              {bsLabel ? (
                <span className="text-[9px] leading-none text-label dark:text-label">
                  {bsLabel}
                </span>
              ) : null}
              <CalendarCategoryDots
                eventTypes={dayEventTypes}
                hasFestival={festivals.length > 0}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
