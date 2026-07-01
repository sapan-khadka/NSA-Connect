import {
  EVENT_TYPE_DOT_CLASS,
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

export function getDayCellSurfaceClass({
  isCurrentMonth,
  isSelected,
  isToday,
}: DayCellSurfaceOptions): string {
  const classes = [
    "relative flex min-h-[2.75rem] flex-col items-center justify-center gap-0 px-0.5 py-1 sm:min-h-[3rem]",
    "rounded-[8px] border border-transparent text-sm",
    "bg-white text-foreground dark:bg-gray-900 dark:text-gray-100",
    "shadow-[0_2px_6px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.35)]",
    "transition-[transform,box-shadow,opacity,border-color,background-color] duration-150 ease-out",
    "hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.45)]",
  ];

  if (!isCurrentMonth) {
    classes.push("opacity-40 hover:opacity-55 text-label dark:text-label");
  }

  if (isSelected) {
    classes.push(
      "z-10 -translate-y-0.5 border-accent",
      "shadow-[0_6px_16px_rgba(0,0,0,0.12)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.5)]",
      "hover:shadow-[0_8px_18px_rgba(0,0,0,0.14)] dark:hover:shadow-[0_8px_20px_rgba(0,0,0,0.55)]",
    );
  } else if (isToday) {
    classes.push(
      "bg-accent/5 dark:bg-accent/20",
      "ring-2 ring-accent/75 dark:ring-accent/90",
      "shadow-[0_2px_6px_rgba(0,0,0,0.06),0_0_0_4px_rgba(2,124,104,0.22)]",
      "dark:shadow-[0_2px_6px_rgba(0,0,0,0.35),0_0_0_4px_rgba(2,124,104,0.35)]",
    );
  }

  return classes.join(" ");
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

  const visible = dots.slice(0, 3);
  const overflow = dots.length - visible.length;

  return (
    <div
      aria-hidden="true"
      className="absolute bottom-1 flex items-center gap-0.5"
      data-testid="calendar-category-dots"
    >
      {visible.map((dot) => (
        <span
          key={dot.key}
          className={`h-1.5 w-1.5 rounded-full ${dot.className}`}
        />
      ))}
      {overflow > 0 ? (
        <span className="text-[9px] font-semibold leading-none text-label dark:text-label">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
