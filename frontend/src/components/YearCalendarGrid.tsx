import { getMonthLabel } from "../lib/calendar";
import {
  buildCategoryMarks,
  CalendarEventMark,
  getYearMonthLabelClass,
  getYearMonthTileClass,
} from "./calendar-grid-utils";
import type { EventType } from "../lib/event-types";

type YearCalendarGridProps = {
  year: number;
  eventTypesByMonth: Map<number, EventType[]>;
  currentMonth: number;
  currentYear: number;
  onSelectMonth: (month: number) => void;
};

export function YearCalendarGrid({
  year,
  eventTypesByMonth,
  currentMonth,
  currentYear,
  onSelectMonth,
}: YearCalendarGridProps) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      data-testid="calendar-year-grid"
    >
      {Array.from({ length: 12 }, (_, month) => {
        const eventTypes = eventTypesByMonth.get(month) ?? [];
        const isCurrentMonth = year === currentYear && month === currentMonth;
        const marks = buildCategoryMarks(eventTypes, false);

        return (
          <button
            key={month}
            type="button"
            onClick={() => onSelectMonth(month)}
            className={getYearMonthTileClass({ isCurrentMonth })}
          >
            <span className={getYearMonthLabelClass(isCurrentMonth)}>
              {getMonthLabel(month)}
            </span>
            <div className="mt-2 flex min-h-[14px] items-end justify-center gap-[4px]">
              {marks.length === 0 ? (
                <span className="text-[11px] text-[#C8C8C4]">No events</span>
              ) : (
                marks.slice(0, 5).map((mark) => (
                  <CalendarEventMark
                    key={mark.key}
                    kind={mark.key}
                    className={mark.className}
                    size="cell"
                  />
                ))
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
