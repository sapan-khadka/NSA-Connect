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
  "events-calendar-day-cell relative flex h-full min-h-0 flex-col items-center justify-center gap-0 rounded-none bg-transparent px-0.5 py-0.5 text-sm transition-colors duration-150 ease-out hover:bg-[#F7F7F5]";

const DAY_CELL_TODAY = "is-today bg-[#F3FAF7] text-foreground hover:bg-[#EEF7F3]";

const DAY_CELL_SELECTED = "is-selected bg-[#EAF6F1] hover:bg-[#E3F3EC]";

export function getDayCellSurfaceClass({
  isCurrentMonth,
  isSelected,
  isToday,
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
  "flex min-h-[4.25rem] flex-col items-center justify-center rounded-lg border border-[#E8E8E6] bg-white px-2.5 py-3 text-center transition-colors duration-150 ease-out hover:bg-[#F7F7F5]";

const YEAR_TILE_CURRENT =
  "border-[#B7D4C9] bg-[#EEF7F3] hover:bg-[#E7F2ED]";

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
