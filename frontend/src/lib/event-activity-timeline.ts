import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CalendarClock,
  ImageIcon,
  Mail,
  UserPlus,
  Users,
} from "lucide-react";

import type { EventDetailResponse } from "./events-api";
import { startOfLocalDay, toLocalIsoDate } from "./calendar";

export type EventActivityKind =
  | "budget"
  | "volunteer"
  | "reminder"
  | "photo"
  | "schedule"
  | "invite";

export type EventActivityItem = {
  id: string;
  kind: EventActivityKind;
  title: string;
  detail?: string;
  occurredAt: string; // ISO
  isPlaceholder?: boolean;
};

export type EventActivityDayGroup = {
  key: string;
  label: string;
  items: EventActivityItem[];
};

export const EVENT_ACTIVITY_ICONS: Record<EventActivityKind, LucideIcon> = {
  budget: Banknote,
  volunteer: UserPlus,
  reminder: Mail,
  photo: ImageIcon,
  schedule: CalendarClock,
  invite: Users,
};

function dayKey(iso: string): string {
  return toLocalIsoDate(new Date(iso));
}

export function formatActivityDayLabel(iso: string, now = new Date()): string {
  const day = startOfLocalDay(new Date(iso));
  const today = startOfLocalDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (day.getTime() === today.getTime()) {
    return "Today";
  }
  if (day.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  const diffDays = Math.round(
    (today.getTime() - day.getTime()) / 86_400_000,
  );
  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(day);
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(day);
}

export function formatActivityTimeLabel(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;

  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24 && startOfLocalDay(new Date(iso)).getTime() === startOfLocalDay(now).getTime()) {
    if (hours < 6) {
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Compact “Jul 4 · 7:17 PM” for flat activity lists (no day headers). */
export function formatActivityDateTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }
  const day = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day} · ${time}`;
}

/**
 * Build an activity timeline from known event signals only.
 * Omits invented reminder / sample volunteer / sample poster rows.
 */
export function buildEventActivityTimeline(input: {
  event: EventDetailResponse;
  volunteerCount: number;
  hasBudget: boolean;
  now?: Date;
}): EventActivityItem[] {
  const now = input.now ?? new Date();
  const items: EventActivityItem[] = [];
  const startsAt = input.event.starts_at
    ? new Date(input.event.starts_at)
    : null;

  if (input.hasBudget) {
    items.push({
      id: "budget-assigned",
      kind: "budget",
      title: "Budget assigned",
      detail: "A planned budget is set for this event.",
      occurredAt: (startsAt ?? now).toISOString(),
      isPlaceholder: false,
    });
  }

  if (input.volunteerCount > 0) {
    items.push({
      id: "volunteer-assigned",
      kind: "volunteer",
      title: "Volunteers signed up",
      detail:
        input.volunteerCount === 1
          ? "1 member signed up to help."
          : `${input.volunteerCount} members signed up to help.`,
      occurredAt: now.toISOString(),
      isPlaceholder: false,
    });
  }

  if (input.event.event_photo_url) {
    items.push({
      id: "poster-uploaded",
      kind: "photo",
      title: "Cover photo set",
      detail: "Cover photo is live on the event card.",
      occurredAt: (startsAt ?? now).toISOString(),
      isPlaceholder: false,
    });
  }

  if (startsAt && Number.isFinite(startsAt.getTime())) {
    items.push({
      id: "schedule-set",
      kind: "schedule",
      title: "Date & time set",
      detail: "Event schedule is saved on the manage page.",
      occurredAt: startsAt.toISOString(),
      isPlaceholder: false,
    });
  }

  return items.sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

export function groupEventActivityByDay(
  items: EventActivityItem[],
  now = new Date(),
): EventActivityDayGroup[] {
  const groups = new Map<string, EventActivityDayGroup>();

  for (const item of items) {
    const key = dayKey(item.occurredAt);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    groups.set(key, {
      key,
      label: formatActivityDayLabel(item.occurredAt, now),
      items: [item],
    });
  }

  return Array.from(groups.values()).sort((a, b) =>
    b.key.localeCompare(a.key),
  );
}
