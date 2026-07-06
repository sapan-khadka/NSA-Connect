export const EVENT_TYPES = [
  "cultural",
  "meeting",
  "fundraiser",
  "social",
  "service",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type MeetingVisibility = "board_only" | "public";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  cultural: "Cultural",
  meeting: "Meeting",
  fundraiser: "Fundraiser",
  social: "Social",
  service: "Service",
};

/** Saturated calendar / legend colors. */
export const EVENT_TYPE_COLOR: Record<EventType, string> = {
  cultural: "#D85A30",
  meeting: "#378ADD",
  fundraiser: "#EF9F27",
  social: "#639922",
  service: "#1D9E75",
};

export const FESTIVAL_EVENT_COLOR = "#7F77DD";

export function isCulturalEvent(eventType: EventType): boolean {
  return eventType === "cultural";
}

/** Tailwind background classes for calendar category dots — full strings for JIT. */
export const EVENT_TYPE_DOT_CLASS: Record<EventType, string> = {
  cultural: "bg-[#D85A30]",
  meeting: "bg-[#378ADD]",
  fundraiser: "bg-[#EF9F27]",
  social: "bg-[#639922]",
  service: "bg-[#1D9E75]",
};

export const FESTIVAL_DOT_CLASS = "bg-[#7F77DD]";

/** Legacy translucent fills — kept for any non-grid references. */
export const EVENT_TYPE_DAY_CLASS: Record<EventType, string> = {
  cultural: "bg-[#D85A30]/15",
  meeting: "bg-[#378ADD]/15",
  fundraiser: "bg-[#EF9F27]/15",
  social: "bg-[#639922]/15",
  service: "bg-[#1D9E75]/15",
};

export const EVENT_TYPE_DAY_HOVER_CLASS: Record<EventType, string> = {
  cultural: "hover:bg-[#D85A30]/20",
  meeting: "hover:bg-[#378ADD]/20",
  fundraiser: "hover:bg-[#EF9F27]/20",
  social: "hover:bg-[#639922]/20",
  service: "hover:bg-[#1D9E75]/20",
};

export const EVENT_TYPE_DAY_SELECTED_CLASS: Record<EventType, string> = {
  cultural: "bg-[#D85A30]/20 ring-2 ring-inset ring-[#D85A30]",
  meeting: "bg-[#378ADD]/20 ring-2 ring-inset ring-[#378ADD]",
  fundraiser: "bg-[#EF9F27]/20 ring-2 ring-inset ring-[#EF9F27]",
  social: "bg-[#639922]/20 ring-2 ring-inset ring-[#639922]",
  service: "bg-[#1D9E75]/20 ring-2 ring-inset ring-[#1D9E75]",
};

export const EVENT_TYPE_DAY_MUTED_CLASS: Record<EventType, string> = {
  cultural: "bg-[#D85A30]/8",
  meeting: "bg-[#378ADD]/8",
  fundraiser: "bg-[#EF9F27]/8",
  social: "bg-[#639922]/8",
  service: "bg-[#1D9E75]/8",
};

export function getCalendarDayCellClass(
  eventTypes: EventType[],
  options: {
    isSelected: boolean;
    isCurrentMonth: boolean;
  },
): string {
  const { isSelected, isCurrentMonth } = options;

  if (eventTypes.length === 0) {
    return isSelected
      ? "bg-accent/10 ring-2 ring-inset ring-accent"
      : "bg-white hover:bg-accent/5";
  }

  const primaryType = eventTypes[0];

  if (!isCurrentMonth) {
    return EVENT_TYPE_DAY_MUTED_CLASS[primaryType];
  }

  if (isSelected) {
    return EVENT_TYPE_DAY_SELECTED_CLASS[primaryType];
  }

  return [
    EVENT_TYPE_DAY_CLASS[primaryType],
    EVENT_TYPE_DAY_HOVER_CLASS[primaryType],
  ].join(" ");
}

export const EVENT_TYPE_BADGE_CLASS: Record<EventType, string> = {
  cultural: "bg-mint text-primary",
  meeting: "bg-mint text-primary",
  fundraiser: "bg-mint text-primary",
  social: "bg-mint text-primary",
  service: "bg-mint text-primary",
};
