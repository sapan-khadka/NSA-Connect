import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AppIcon } from "./ui/AppIcon";
import { SegmentedControl } from "./ui/SegmentedControl";

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
import { getFestivalsOnDate } from "../lib/nepali-calendar";
import { YearCalendarGrid } from "./YearCalendarGrid";
import { CalendarMonthYearPicker } from "./CalendarMonthYearPicker";
import {
  CalendarCategoryMarks,
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

const CALENDAR_VIEW_OPTIONS = [
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
] as const;

function CalendarViewToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
}) {
  return (
    <SegmentedControl
      ariaLabel="Calendar view"
      value={viewMode}
      options={CALENDAR_VIEW_OPTIONS}
      onChange={onViewModeChange}
    />
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
      className="events-calendar-card"
    >
      <div className="events-calendar-panel-controls">
        <button
          type="button"
          onClick={onGoToToday}
          className="event-command-btn"
        >
          Today
        </button>

        <div className="events-calendar-panel-nav">
          <button
            type="button"
            aria-label={viewMode === "year" ? "Previous year" : "Previous month"}
            onClick={goToPrevious}
            className="event-command-btn event-command-btn--icon"
          >
            <AppIcon icon={ChevronLeft} size="sm" className="text-foreground" />
          </button>

          <div
            className="events-calendar-panel-nav-center min-w-0"
            data-testid="calendar-month-label"
          >
            <CalendarMonthYearPicker
              year={year}
              month={month}
              showMonth={viewMode === "month"}
              onChange={onMonthChange}
            />
          </div>

          <button
            type="button"
            aria-label={viewMode === "year" ? "Next year" : "Next month"}
            onClick={goToNext}
            className="event-command-btn event-command-btn--icon"
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
          className={["events-calendar-grid", monthAnimationClass].join(" ")}
          data-testid="calendar-month-grid"
        >
          <div className="events-calendar-grid__weekdays" aria-hidden="true">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="events-calendar-grid__weekday">
                {label}
              </div>
            ))}
          </div>

          <div className="events-calendar-grid__days">
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
                <CalendarCategoryMarks
                  eventTypes={dayEventTypes}
                  hasFestival={festivals.length > 0}
                />
              </button>
            );
          })}
          </div>
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
        <CalendarLegendList className="events-calendar-legend" />
      ) : null}
    </section>
  );
}
