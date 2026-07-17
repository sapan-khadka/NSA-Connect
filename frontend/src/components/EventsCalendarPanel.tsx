import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AppIcon } from "./ui/AppIcon";

import {
  WEEKDAY_LABELS,
  addMonths,
  buildMonthGrid,
  getMonthLabel,
  isToday,
  toLocalIsoDate,
} from "../lib/calendar";
import type { CalendarEventInput } from "../lib/calendar-events";
import { groupEventTypesByDate, groupEventTypesByMonth } from "../lib/calendar-events";
import {
  EVENT_TYPE_LABELS,
} from "../lib/event-types";
import { formatNepaliMonthRange } from "../lib/nepali-calendar";
import { getFestivalsOnDate, toBikramSambat } from "../lib/nepali-calendar";
import { CalendarMonthYearPicker } from "./CalendarMonthYearPicker";
import { YearCalendarGrid } from "./YearCalendarGrid";
import {
  CalendarCategoryDots,
  CalendarLegendList,
  getDayCellSurfaceClass,
  getMonthEnterAnimationClass,
  getTodayDateNumberClass,
  type MonthEnterDirection,
} from "./calendar-grid-utils";

export type CalendarViewMode = "month" | "year";

type EventsCalendarPanelProps = {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  onGoToToday: () => void;
  selectedDate: string | null;
  onSelectDate: (isoDate: string) => void;
  monthEvents: CalendarEventInput[];
  yearEvents: CalendarEventInput[];
};

function CalendarViewToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Calendar view"
      className="inline-flex rounded-full bg-[#F5F5F7] p-0.5"
    >
      {(["month", "year"] as const).map((mode) => {
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            onClick={() => onViewModeChange(mode)}
            className={[
              "min-h-8 rounded-full px-2.5 py-1 text-[13px] font-medium capitalize transition-colors",
              active
                ? "bg-primary text-white"
                : "text-label hover:text-foreground",
            ].join(" ")}
          >
            {mode}
          </button>
        );
      })}
    </div>
  );
}

export function EventsCalendarPanel({
  viewMode,
  onViewModeChange,
  year,
  month,
  onMonthChange,
  onGoToToday,
  selectedDate,
  onSelectDate,
  monthEvents,
  yearEvents,
}: EventsCalendarPanelProps) {
  const [monthEnterDirection, setMonthEnterDirection] =
    useState<MonthEnterDirection>(null);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const eventTypesByDate = useMemo(
    () => groupEventTypesByDate(monthEvents),
    [monthEvents],
  );
  const eventTypesByMonth = useMemo(
    () => groupEventTypesByMonth(yearEvents, year),
    [yearEvents, year],
  );
  const today = new Date();
  const monthAnimationClass = getMonthEnterAnimationClass(monthEnterDirection);
  const nepaliRange = formatNepaliMonthRange(year, month);

  function goToPrevious() {
    if (viewMode === "year") {
      onMonthChange(year - 1, month);
      return;
    }
    setMonthEnterDirection("prev");
    const next = addMonths(year, month, -1);
    onMonthChange(next.year, next.month);
  }

  function goToNext() {
    if (viewMode === "year") {
      onMonthChange(year + 1, month);
      return;
    }
    setMonthEnterDirection("next");
    const next = addMonths(year, month, 1);
    onMonthChange(next.year, next.month);
  }

  function handleSelectMonth(nextMonth: number) {
    onMonthChange(year, nextMonth);
    onViewModeChange("month");
  }

  return (
    <section
      aria-label={viewMode === "month" ? `${getMonthLabel(month)} ${year}` : `${year}`}
      className="events-calendar-card p-3 sm:p-3.5"
    >
      <div className="events-calendar-panel-controls">
        <button
          type="button"
          onClick={onGoToToday}
          className="min-h-8 shrink-0 rounded-md px-2.5 py-1 text-[13px] font-medium text-primary transition-colors duration-200 hover:bg-primary/5"
        >
          Today
        </button>

        <div className="events-calendar-panel-nav">
          <button
            type="button"
            aria-label={viewMode === "year" ? "Previous year" : "Previous month"}
            onClick={goToPrevious}
            className="ds-icon-btn h-8 w-8 rounded-md text-foreground transition-colors duration-200 hover:bg-[#F5F5F7]"
          >
            <AppIcon icon={ChevronLeft} size="sm" className="text-foreground" />
          </button>

          <div className="events-calendar-panel-nav-center min-w-0">
            {viewMode === "month" ? (
              <>
                <h2
                  data-testid="calendar-month-label"
                  className="truncate text-[15px] font-semibold tracking-[-0.02em] text-foreground"
                >
                  {getMonthLabel(month)}{" "}
                  <span className="font-medium text-label">{year}</span>
                </h2>
                {nepaliRange ? (
                  <p className="events-calendar-nepali-range">{nepaliRange}</p>
                ) : null}
                <div className="events-calendar-panel-picker">
                  <CalendarMonthYearPicker
                    year={year}
                    month={month}
                    onChange={onMonthChange}
                  />
                </div>
              </>
            ) : (
              <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">
                <span className="font-medium text-label">{year}</span>
              </h2>
            )}
          </div>

          <button
            type="button"
            aria-label={viewMode === "year" ? "Next year" : "Next month"}
            onClick={goToNext}
            className="ds-icon-btn h-8 w-8 rounded-md text-foreground transition-colors duration-200 hover:bg-[#F5F5F7]"
          >
            <AppIcon icon={ChevronRight} size="sm" className="text-foreground" />
          </button>
        </div>

        <CalendarViewToggle
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
      </div>

      {viewMode === "month" ? (
        <div
          key={`${year}-${month}`}
          className={[
            "events-calendar-grid mt-3 grid grid-cols-7 gap-1 sm:gap-1.5",
            monthAnimationClass,
          ].join(" ")}
          data-testid="calendar-month-grid"
        >
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-0.5 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-label sm:text-[11px]"
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
                onClick={() => onSelectDate(cell.isoDate)}
                className={getDayCellSurfaceClass({
                  isCurrentMonth: cell.isCurrentMonth,
                  isSelected,
                  isToday: cellIsToday,
                })}
              >
                <span className={getTodayDateNumberClass(cellIsToday, isSelected)}>
                  {cell.day}
                </span>
                {bsLabel ? (
                  <span className="events-calendar-bs-date hidden text-[10px] leading-none text-label min-[400px]:inline">
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
      ) : (
        <div className="mt-3">
          <YearCalendarGrid
            year={year}
            eventTypesByMonth={eventTypesByMonth}
            currentMonth={today.getMonth()}
            currentYear={today.getFullYear()}
            onSelectMonth={handleSelectMonth}
          />
        </div>
      )}

      {viewMode === "month" ? (
        <CalendarLegendList className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-[#F0F0EE] pt-3 text-[11px] text-label" />
      ) : null}
    </section>
  );
}
