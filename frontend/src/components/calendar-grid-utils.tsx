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
  "events-calendar-day-cell relative flex h-full min-h-0 flex-col items-center justify-center gap-0 rounded-none px-0.5 py-0.5 text-sm transition-colors duration-150 ease-out hover:bg-[#F7F7F5]";

const DAY_CELL_TODAY = "is-today text-foreground hover:bg-[#F4F4F3]";

const DAY_CELL_SELECTED = "is-selected hover:bg-[color-mix(in_srgb,var(--color-primary,#111111)_7%,#fff)]";

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
  if (isToday || isSelected) {
    return "text-sm font-semibold text-foreground transition-colors duration-200";
  }
  return "text-sm font-medium transition-colors duration-200";
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

type CategoryMark = {
  key: string;
  className: string;
};

export function buildCategoryMarks(
  eventTypes: EventType[],
  hasFestival: boolean,
): CategoryMark[] {
  const marks: CategoryMark[] = eventTypes.map((eventType) => ({
    key: eventType,
    className: EVENT_TYPE_DOT_CLASS[eventType],
  }));

  if (hasFestival) {
    marks.push({ key: "festival", className: FESTIVAL_DOT_CLASS });
  }

  return marks;
}

/** @deprecated Use buildCategoryMarks */
export const buildCategoryDots = buildCategoryMarks;

const PIN_PATH =
  "M10 0C4.48 0 0 4.42 0 9.86c0 6.84 9.14 17.64 10 18.14.86-.5 10-11.3 10-18.14C20 4.42 15.52 0 10 0zm0 13.4A3.54 3.54 0 1 1 10 6.3a3.54 3.54 0 0 1 0 7.1z";

function CalendarEventMark({
  className,
  size = "cell",
  kind,
}: {
  className: string;
  size?: "cell" | "legend" | "row";
  kind?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={[
        "calendar-event-mark",
        `is-${size}`,
        kind ? `is-kind-${kind}` : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <svg viewBox="0 0 20 28" focusable="false">
        <path fill="currentColor" fillRule="evenodd" d={PIN_PATH} />
      </svg>
    </span>
  );
}

type CalendarCategoryMarksProps = {
  eventTypes: EventType[];
  hasFestival: boolean;
};

export function CalendarCategoryMarks({
  eventTypes,
  hasFestival,
}: CalendarCategoryMarksProps) {
  const marks = buildCategoryMarks(eventTypes, hasFestival);
  if (marks.length === 0) {
    return null;
  }

  const visible = marks.slice(0, 3);
  const overflow = marks.length - visible.length;

  return (
    <div
      aria-hidden="true"
      className="calendar-event-marks"
      data-testid="calendar-category-marks"
    >
      {visible.map((mark) => (
        <CalendarEventMark
          key={mark.key}
          kind={mark.key}
          className={mark.className}
        />
      ))}
      {overflow > 0 ? (
        <span className="calendar-event-marks__more">+{overflow}</span>
      ) : null}
    </div>
  );
}

export function CalendarLegendList({ className }: { className?: string }) {
  return (
    <ul aria-label="Event type legend" className={className}>
      {EVENT_TYPES.map((eventType) => (
        <li key={eventType} className="flex items-center gap-1.5">
          <CalendarEventMark
            className={EVENT_TYPE_DOT_CLASS[eventType]}
            kind={eventType}
            size="legend"
          />
          {EVENT_TYPE_LABELS[eventType]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <CalendarEventMark
          className={FESTIVAL_DOT_CLASS}
          kind="festival"
          size="legend"
        />
        Nepali festival
      </li>
    </ul>
  );
}

export { CalendarEventMark };
