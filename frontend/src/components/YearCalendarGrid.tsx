import { getMonthLabel } from "../lib/calendar";
import {
  getYearMonthLabelClass,
  getYearMonthTileClass,
} from "./calendar-grid-utils";

type YearCalendarGridProps = {
  year: number;
  eventCountByMonth: Map<number, number>;
  currentMonth: number;
  currentYear: number;
  onSelectMonth: (month: number) => void;
};

export function YearCalendarGrid({
  year,
  eventCountByMonth,
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
        const count = eventCountByMonth.get(month) ?? 0;
        const isCurrentMonth = year === currentYear && month === currentMonth;

        return (
          <button
            key={month}
            type="button"
            onClick={() => onSelectMonth(month)}
            aria-label={
              count === 0
                ? `${getMonthLabel(month)}, no events`
                : `${getMonthLabel(month)}, ${count} ${count === 1 ? "event" : "events"}`
            }
            className={getYearMonthTileClass({ isCurrentMonth })}
          >
            <span className={getYearMonthLabelClass(isCurrentMonth)}>
              {getMonthLabel(month)}
            </span>
            <span
              className={[
                "mt-2 text-[11px] font-medium",
                count === 0 ? "text-[#a3a3a3]" : "text-[#737373]",
              ].join(" ")}
            >
              {count === 0
                ? "No events"
                : `${count} ${count === 1 ? "event" : "events"}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
