export type MonthEnterDirection = "prev" | "next" | null;

export function getMonthEnterAnimationClass(
  direction: MonthEnterDirection,
): string {
  if (direction === "prev") {
    return "calendar-month-enter-from-prev";
  }
  if (direction === "next") {
    return "calendar-month-enter-from-next";
  }
  return "";
}

type DayCellSurfaceOptions = {
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  hasEvents?: boolean;
  hasFestival?: boolean;
};

const DAY_CELL_BASE =
  "events-calendar-day-cell relative flex h-full min-h-0 flex-col items-stretch justify-start gap-0 rounded-none px-1 py-1 text-left text-sm transition-colors duration-150 ease-out hover:bg-[#F7F7F5]";

const DAY_CELL_TODAY = "is-today text-foreground hover:bg-[#F4F4F3]";

const DAY_CELL_SELECTED =
  "is-selected hover:bg-[color-mix(in_srgb,var(--color-primary,#c8102e)_7%,#fff)]";

export function getDayCellSurfaceClass({
  isCurrentMonth,
  isSelected,
  isToday,
  hasEvents = false,
  hasFestival = false,
}: DayCellSurfaceOptions): string {
  const classes = [DAY_CELL_BASE];

  if (!isCurrentMonth) {
    classes.push("is-outside text-label");
  } else {
    classes.push("text-foreground");
  }

  if (isSelected) {
    classes.push(DAY_CELL_SELECTED);
  } else if (isToday) {
    classes.push(DAY_CELL_TODAY);
  }

  if (hasEvents) {
    classes.push("has-events");
  } else if (hasFestival) {
    classes.push("has-festival");
  }

  return classes.join(" ");
}

export function getTodayDateNumberClass(isToday: boolean, isSelected: boolean): string {
  if (isToday || isSelected) {
    return "events-calendar-day-num is-emphasis";
  }
  return "events-calendar-day-num";
}

type YearMonthTileOptions = {
  isCurrentMonth: boolean;
};

const YEAR_TILE_BASE =
  "flex min-h-[4.25rem] flex-col items-center justify-center rounded-none border border-[#ebebea] bg-transparent px-2.5 py-3 text-center transition-colors duration-150 ease-out hover:bg-[#fafafa]";

const YEAR_TILE_CURRENT =
  "border-[#171717] bg-[#fafafa] hover:bg-[#f5f5f4]";

export function getYearMonthTileClass({
  isCurrentMonth,
}: YearMonthTileOptions): string {
  if (isCurrentMonth) {
    return [YEAR_TILE_BASE, YEAR_TILE_CURRENT].join(" ");
  }

  return YEAR_TILE_BASE;
}

export function getYearMonthLabelClass(isCurrentMonth: boolean): string {
  if (isCurrentMonth) {
    return "text-sm font-semibold text-[#171717]";
  }

  return "text-sm font-medium text-foreground";
}
