import { getMonthLabel } from "../lib/calendar";
import {
  buildCategoryDots,
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
        const dots = buildCategoryDots(eventTypes, false);

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
            <div className="mt-2 flex min-h-[5px] items-center justify-center gap-[3px]">
              {dots.length === 0 ? (
                <span className="text-[11px] text-[#C8C8C4]">No events</span>
              ) : (
                dots.slice(0, 5).map((dot) => (
                  <span
                    key={dot.key}
                    aria-hidden="true"
                    className={`h-[5px] w-[5px] rounded-full ${dot.className}`}
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
