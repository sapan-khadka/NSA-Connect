import {
  EVENT_TYPE_DOT_CLASS,
  EVENT_TYPE_LABELS,
  EVENT_TYPES,
  FESTIVAL_DOT_CLASS,
  type EventType,
} from "../lib/event-types";

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
};

const DAY_CELL_BASE =
  "relative flex min-h-8 flex-col items-center justify-center gap-0 rounded-[8px] border border-transparent bg-white px-0.5 py-0.5 text-sm transition-all duration-200 ease-out sm:min-h-[2.35rem] sm:py-0.5 hover:-translate-y-px hover:bg-[#F5F9F7] hover:shadow-[0_2px_6px_rgba(2,124,104,0.08)]";

const DAY_CELL_TILE_SHADOW =
  "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_3px_8px_rgba(0,0,0,0.04)]";

const DAY_CELL_TODAY =
  "bg-gradient-to-b from-[#E7F4F0] to-[#DCF0E8] shadow-[0_0_0_3px_#E7F4F0,0_3px_10px_rgba(2,124,104,0.18)] hover:-translate-y-px hover:shadow-[0_0_0_3px_#E7F4F0,0_6px_16px_rgba(2,124,104,0.22)]";

const DAY_CELL_SELECTED =
  "z-10 border-[#7BB8A8] bg-[#EAF6F1] shadow-[0_1px_2px_rgba(2,124,104,0.08),0_4px_12px_rgba(2,124,104,0.12)] hover:-translate-y-px hover:border-[#5FA894] hover:bg-[#E3F3EC] hover:shadow-[0_2px_4px_rgba(2,124,104,0.1),0_8px_16px_rgba(2,124,104,0.16)]";

export function getDayCellSurfaceClass({
  isCurrentMonth,
  isSelected,
  isToday,
}: DayCellSurfaceOptions): string {
  const classes = [DAY_CELL_BASE];

  if (!isCurrentMonth) {
    classes.push("text-label opacity-50");
  } else {
    classes.push("text-foreground");
  }

  if (isSelected && isToday) {
    classes.push(DAY_CELL_TODAY, DAY_CELL_SELECTED);
  } else if (isSelected) {
    classes.push(DAY_CELL_SELECTED);
  } else if (isToday) {
    classes.push(DAY_CELL_TODAY);
  } else {
    classes.push(DAY_CELL_TILE_SHADOW);
  }

  return classes.join(" ");
}

export function getTodayDateNumberClass(isToday: boolean, isSelected: boolean): string {
  if (isToday) {
    return "text-sm font-semibold text-[#027C68] transition-colors duration-200";
  }
  if (isSelected) {
    return "text-sm font-bold text-[#0F5C4C] transition-colors duration-200";
  }
  return "text-sm font-medium transition-colors duration-200";
}

type YearMonthTileOptions = {
  isCurrentMonth: boolean;
};

const YEAR_TILE_BASE =
  "flex min-h-[5.5rem] flex-col items-center justify-center rounded-[14px] border border-transparent bg-white px-3 py-4 text-center transition-all duration-150 ease-out";

const YEAR_TILE_SHADOW =
  "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.06),0_10px_22px_rgba(0,0,0,0.08)]";

const YEAR_TILE_CURRENT =
  "bg-gradient-to-b from-[#E7F4F0] to-[#DCF0E8] shadow-[0_0_0_3px_#E7F4F0,0_3px_10px_rgba(2,124,104,0.18)] hover:-translate-y-0.5 hover:shadow-[0_0_0_3px_#E7F4F0,0_6px_16px_rgba(2,124,104,0.22)]";

export function getYearMonthTileClass({
  isCurrentMonth,
}: YearMonthTileOptions): string {
  if (isCurrentMonth) {
    return [YEAR_TILE_BASE, YEAR_TILE_CURRENT].join(" ");
  }

  return [YEAR_TILE_BASE, YEAR_TILE_SHADOW].join(" ");
}

export function getYearMonthLabelClass(isCurrentMonth: boolean): string {
  if (isCurrentMonth) {
    return "text-sm font-semibold text-[#027C68]";
  }

  return "text-sm font-medium text-foreground";
}

type CategoryDot = {
  key: string;
  className: string;
};

export function buildCategoryDots(
  eventTypes: EventType[],
  hasFestival: boolean,
): CategoryDot[] {
  const dots: CategoryDot[] = eventTypes.map((eventType) => ({
    key: eventType,
    className: EVENT_TYPE_DOT_CLASS[eventType],
  }));

  if (hasFestival) {
    dots.push({ key: "festival", className: FESTIVAL_DOT_CLASS });
  }

  return dots;
}

type CalendarCategoryDotsProps = {
  eventTypes: EventType[];
  hasFestival: boolean;
};

export function CalendarCategoryDots({
  eventTypes,
  hasFestival,
}: CalendarCategoryDotsProps) {
  const dots = buildCategoryDots(eventTypes, hasFestival);
  if (dots.length === 0) {
    return null;
  }

  const visible = dots.slice(0, 4);
  const overflow = dots.length - visible.length;

  return (
    <div
      aria-hidden="true"
      className="mt-0.5 flex items-center justify-center gap-[3px]"
      data-testid="calendar-category-dots"
    >
      {visible.map((dot) => (
        <span
          key={dot.key}
          className={`h-[5px] w-[5px] rounded-full ${dot.className}`}
        />
      ))}
      {overflow > 0 ? (
        <span className="text-[9px] font-semibold leading-none text-label">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

export function CalendarLegendList({ className }: { className?: string }) {
  return (
    <ul aria-label="Event type legend" className={className}>
      {EVENT_TYPES.map((eventType) => (
        <li key={eventType} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-[5px] w-[5px] rounded-full ${EVENT_TYPE_DOT_CLASS[eventType]}`}
          />
          {EVENT_TYPE_LABELS[eventType]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={`h-[5px] w-[5px] rounded-full ${FESTIVAL_DOT_CLASS}`}
        />
        Nepali festival
      </li>
    </ul>
  );
}
