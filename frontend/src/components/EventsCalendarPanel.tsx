import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

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
import type { EventResponse } from "../lib/events-api";

export type CalendarViewMode = "month" | "year";

type EventsCalendarPanelProps = {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  selectedDate: string | null;
  onSelectDate: (isoDate: string) => void;
  monthEvents: CalendarEventInput[];
  yearEvents: CalendarEventInput[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: EventResponse[];
  onSelectSearchResult: (event: EventResponse) => void;
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
              "min-h-11 rounded-full px-3.5 py-2 text-sm font-medium capitalize transition-colors",
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
  selectedDate,
  onSelectDate,
  monthEvents,
  yearEvents,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSelectSearchResult,
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
  const todayIso = toLocalIsoDate(new Date());
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

  function goToToday() {
    const now = new Date();
    setMonthEnterDirection(null);
    onMonthChange(now.getFullYear(), now.getMonth());
    onSelectDate(todayIso);
    onViewModeChange("month");
  }

  function handleSelectMonth(nextMonth: number) {
    onMonthChange(year, nextMonth);
    onViewModeChange("month");
  }

  return (
    <section
      aria-label={viewMode === "month" ? `${getMonthLabel(month)} ${year}` : `${year}`}
      className="events-calendar-card overflow-hidden p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {viewMode === "month" ? (
            <>
              <h2
                data-testid="calendar-month-label"
                className="text-2xl font-light tracking-[-0.02em] text-foreground sm:text-[32px]"
              >
                {getMonthLabel(month)}{" "}
                <span className="text-label">{year}</span>
              </h2>
              <p className="mt-0.5 text-[13px] text-label">{nepaliRange}</p>
            </>
          ) : (
            <h2 className="text-[32px] font-light tracking-[-0.02em] text-foreground">
              <span className="text-label">{year}</span>
            </h2>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CalendarViewToggle
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-label"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search events…"
            aria-label="Search events"
            className="w-full rounded-[10px] border border-[#F0F0EE] bg-white py-3 pl-[34px] pr-3 text-base text-foreground outline-none transition-colors placeholder:text-label focus:border-primary/30 focus:ring-2 focus:ring-primary/10 sm:py-2 sm:text-sm"
          />
          {searchQuery.trim() && searchResults.length > 0 ? (
            <ul
              role="listbox"
              aria-label="Search results"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-[10px] border border-[#F0F0EE] bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
            >
              {searchResults.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    role="option"
                    className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-[#F5F5F7]"
                    onClick={() => onSelectSearchResult(event)}
                  >
                    <span className="text-foreground">{event.name}</span>
                    <span className="shrink-0 text-xs text-label">
                      {EVENT_TYPE_LABELS[event.event_type]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={viewMode === "year" ? "Previous year" : "Previous month"}
            onClick={goToPrevious}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-[#F5F5F7]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="min-h-11 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            Today
          </button>
          {viewMode === "month" ? (
            <CalendarMonthYearPicker
              year={year}
              month={month}
              onChange={onMonthChange}
            />
          ) : null}
          <button
            type="button"
            aria-label={viewMode === "year" ? "Next year" : "Next month"}
            onClick={goToNext}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-[#F5F5F7]"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {viewMode === "month" ? (
        <div
          key={`${year}-${month}`}
          className={["mt-5 grid grid-cols-7 gap-1 sm:gap-2", monthAnimationClass].join(" ")}
          data-testid="calendar-month-grid"
        >
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-0.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-label sm:text-[11px]"
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
                  <span className="hidden text-[10px] leading-none text-label min-[400px]:inline">
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
        <div className="mt-5">
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
        <CalendarLegendList className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#F0F0EE] pt-4 text-[11px] text-label" />
      ) : null}
    </section>
  );
}
