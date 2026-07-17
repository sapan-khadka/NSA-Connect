export type CalendarCell = {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isoDate: string;
};

export type MonthYear = {
  year: number;
  month: number;
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Days in month using Date rollover: day 0 of next month = last day of this month. */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Weekday index for the 1st (0 = Sunday). */
export function getFirstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/** Local YYYY-MM-DD — avoids UTC shift from toISOString(). */
export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Local midnight for the given date's calendar day. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date, today: Date = new Date()): boolean {
  return isSameDay(date, today);
}

export function addMonths(
  year: number,
  month: number,
  delta: number,
): MonthYear {
  const anchor = new Date(year, month + delta, 1);
  return { year: anchor.getFullYear(), month: anchor.getMonth() };
}

export function formatMonthYear(year: number, month: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
}

const monthLabelFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
});

/** Month index (0–11) › display label for pickers. */
export function getMonthLabel(month: number): string {
  return monthLabelFormatter.format(new Date(2024, month, 1));
}

export function getMonthOptions(): Array<{ value: number; label: string }> {
  return Array.from({ length: 12 }, (_, month) => ({
    value: month,
    label: getMonthLabel(month),
  }));
}

/** Years around today, always including the currently viewed year. */
export function getCalendarYearOptions(
  viewedYear: number,
  today: Date = new Date(),
): number[] {
  const currentYear = today.getFullYear();
  const minYear = Math.min(currentYear - 2, viewedYear);
  const maxYear = Math.max(currentYear + 3, viewedYear);
  const years: number[] = [];

  for (let year = minYear; year <= maxYear; year += 1) {
    years.push(year);
  }

  return years;
}

/**
 * Build a month grid aligned to Sunday-start weeks.
 * Leading/trailing cells belong to adjacent months so every row has 7 days.
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstWeekday = getFirstWeekday(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const gridStart = new Date(year, month, 1 - firstWeekday);
  const cells: CalendarCell[] = [];

  for (let offset = 0; offset < totalCells; offset += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + offset,
    );

    cells.push({
      date,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isoDate: toLocalIsoDate(date),
    });
  }

  return cells;
}
