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

/** Tailwind background classes for calendar dots — full strings for JIT scanning. */
export const EVENT_TYPE_DOT_CLASS: Record<EventType, string> = {
  cultural: "bg-red-500",
  meeting: "bg-amber-500",
  fundraiser: "bg-emerald-500",
  social: "bg-blue-500",
  service: "bg-violet-500",
};

/** Transparent fill for calendar day cells — full strings for JIT scanning. */
export const EVENT_TYPE_DAY_CLASS: Record<EventType, string> = {
  cultural: "bg-red-500/20",
  meeting: "bg-amber-500/20",
  fundraiser: "bg-emerald-500/20",
  social: "bg-blue-500/20",
  service: "bg-violet-500/20",
};

export const EVENT_TYPE_DAY_HOVER_CLASS: Record<EventType, string> = {
  cultural: "hover:bg-red-500/30",
  meeting: "hover:bg-amber-500/30",
  fundraiser: "hover:bg-emerald-500/30",
  social: "hover:bg-blue-500/30",
  service: "hover:bg-violet-500/30",
};

export const EVENT_TYPE_DAY_SELECTED_CLASS: Record<EventType, string> = {
  cultural: "bg-red-500/35 ring-2 ring-inset ring-red-400",
  meeting: "bg-amber-500/35 ring-2 ring-inset ring-amber-400",
  fundraiser: "bg-emerald-500/35 ring-2 ring-inset ring-emerald-400",
  social: "bg-blue-500/35 ring-2 ring-inset ring-blue-400",
  service: "bg-violet-500/35 ring-2 ring-inset ring-violet-400",
};

export const EVENT_TYPE_DAY_MUTED_CLASS: Record<EventType, string> = {
  cultural: "bg-red-500/10",
  meeting: "bg-amber-500/10",
  fundraiser: "bg-emerald-500/10",
  social: "bg-blue-500/10",
  service: "bg-violet-500/10",
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
  cultural: "bg-red-100 text-red-800",
  meeting: "bg-amber-100 text-amber-900",
  fundraiser: "bg-emerald-100 text-emerald-900",
  social: "bg-blue-100 text-blue-900",
  service: "bg-violet-100 text-violet-900",
};
