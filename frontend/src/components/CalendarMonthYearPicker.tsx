import {
  getCalendarYearOptions,
  getMonthOptions,
} from "../lib/calendar";

type CalendarMonthYearPickerProps = {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
};

const selectClassName =
  "rounded-md border border-surface-card bg-white px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

export function CalendarMonthYearPicker({
  year,
  month,
  onChange,
}: CalendarMonthYearPickerProps) {
  const monthOptions = getMonthOptions();
  const yearOptions = getCalendarYearOptions(year);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="calendar-month-select">
        Select month
      </label>
      <select
        id="calendar-month-select"
        aria-label="Select month"
        value={month}
        onChange={(event) => {
          const nextMonth = Number(event.target.value);
          if (nextMonth !== month) {
            onChange(year, nextMonth);
          }
        }}
        className={selectClassName}
      >
        {monthOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="calendar-year-select">
        Select year
      </label>
      <select
        id="calendar-year-select"
        aria-label="Select year"
        value={year}
        onChange={(event) => {
          const nextYear = Number(event.target.value);
          if (nextYear !== year) {
            onChange(nextYear, month);
          }
        }}
        className={selectClassName}
      >
        {yearOptions.map((optionYear) => (
          <option key={optionYear} value={optionYear}>
            {optionYear}
          </option>
        ))}
      </select>
    </div>
  );
}
