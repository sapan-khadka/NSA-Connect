import {
  getCalendarYearOptions,
  getMonthOptions,
} from "../lib/calendar";

type CalendarMonthYearPickerProps = {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  /** Hide the month select in year view. */
  showMonth?: boolean;
};

export function CalendarMonthYearPicker({
  year,
  month,
  onChange,
  showMonth = true,
}: CalendarMonthYearPickerProps) {
  const monthOptions = getMonthOptions();
  const yearOptions = getCalendarYearOptions(year);

  return (
    <div className="events-calendar-panel-picker">
      {showMonth ? (
        <>
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
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      ) : null}

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
