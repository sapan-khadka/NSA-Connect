export const EVENT_TYPES = [
  "cultural",
  "meeting",
  "fundraiser",
  "social",
  "service",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  cultural: "Cultural",
  meeting: "Meeting",
  fundraiser: "Fundraiser",
  social: "Social",
  service: "Service",
};

export function isCulturalEvent(eventType: EventType): boolean {
  return eventType === "cultural";
}

/** Tailwind background classes for calendar dots — full strings for JIT scanning. */
export const EVENT_TYPE_DOT_CLASS: Record<EventType, string> = {
  cultural: "bg-red-600",
  meeting: "bg-blue-900",
  fundraiser: "bg-amber-500",
  social: "bg-emerald-600",
  service: "bg-teal-600",
};

/** Transparent fill for calendar day cells — full strings for JIT scanning. */
export const EVENT_TYPE_DAY_CLASS: Record<EventType, string> = {
  cultural: "bg-red-600/20",
  meeting: "bg-blue-900/15",
  fundraiser: "bg-amber-500/20",
  social: "bg-emerald-600/20",
  service: "bg-teal-600/20",
};

export const EVENT_TYPE_DAY_HOVER_CLASS: Record<EventType, string> = {
  cultural: "hover:bg-red-600/30",
  meeting: "hover:bg-blue-900/25",
  fundraiser: "hover:bg-amber-500/30",
  social: "hover:bg-emerald-600/30",
  service: "hover:bg-teal-600/30",
};

export const EVENT_TYPE_DAY_SELECTED_CLASS: Record<EventType, string> = {
  cultural: "bg-red-600/35 ring-2 ring-inset ring-red-500",
  meeting: "bg-blue-900/25 ring-2 ring-inset ring-blue-700",
  fundraiser: "bg-amber-500/35 ring-2 ring-inset ring-amber-400",
  social: "bg-emerald-600/35 ring-2 ring-inset ring-emerald-500",
  service: "bg-teal-600/35 ring-2 ring-inset ring-teal-500",
};

export const EVENT_TYPE_DAY_MUTED_CLASS: Record<EventType, string> = {
  cultural: "bg-red-600/10",
  meeting: "bg-blue-900/10",
  fundraiser: "bg-amber-500/10",
  social: "bg-emerald-600/10",
  service: "bg-teal-600/10",
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
  cultural: "bg-red-100 text-red-900",
  meeting: "bg-blue-100 text-blue-900",
  fundraiser: "bg-amber-100 text-amber-900",
  social: "bg-emerald-100 text-emerald-900",
  service: "bg-teal-100 text-teal-900",
};
