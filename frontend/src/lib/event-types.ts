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

export const EVENT_TYPE_BADGE_CLASS: Record<EventType, string> = {
  cultural: "bg-red-100 text-red-800",
  meeting: "bg-amber-100 text-amber-900",
  fundraiser: "bg-emerald-100 text-emerald-900",
  social: "bg-blue-100 text-blue-900",
  service: "bg-violet-100 text-violet-900",
};
