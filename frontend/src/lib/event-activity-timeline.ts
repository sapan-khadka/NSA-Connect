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
import { startOfLocalDay } from "./calendar";

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
  const date = new Date(iso);
  const local = startOfLocalDay(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

/**
 * Build a readable activity timeline from known event signals + placeholders.
 * No backend activity feed exists yet.
 */
export function buildEventActivityTimeline(input: {
  event: EventDetailResponse;
  volunteerCount: number;
  hasBudget: boolean;
  now?: Date;
}): EventActivityItem[] {
  const now = input.now ?? new Date();
  const items: EventActivityItem[] = [];

  // Recent placeholder: budget update
  if (input.hasBudget) {
    items.push({
      id: "budget-updated",
      kind: "budget",
      title: "Budget updated",
      detail: "Planned spend refreshed for this event.",
      occurredAt: new Date(now.getTime() - 2 * 60_000).toISOString(),
      isPlaceholder: true,
    });
  } else {
    items.push({
      id: "budget-pending",
      kind: "budget",
      title: "Budget not assigned yet",
      detail: "Assign a planned budget when ready.",
      occurredAt: new Date(now.getTime() - 3 * 60_000).toISOString(),
      isPlaceholder: true,
    });
  }

  // Today: volunteer signal (real count when available, else placeholder)
  const todayNoon = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    11,
    20,
  );
  if (input.volunteerCount > 0) {
    items.push({
      id: "volunteer-assigned",
      kind: "volunteer",
      title: "Volunteer assigned",
      detail:
        input.volunteerCount === 1
          ? "1 member signed up to help."
          : `${input.volunteerCount} members signed up to help.`,
      occurredAt: todayNoon.toISOString(),
      isPlaceholder: false,
    });
  } else {
    items.push({
      id: "volunteer-placeholder",
      kind: "volunteer",
      title: "Volunteer assigned",
      detail: "Sample: roles will appear here when members sign up.",
      occurredAt: todayNoon.toISOString(),
      isPlaceholder: true,
    });
  }

  // Yesterday: reminder (placeholder — no reminder API)
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  yesterday.setHours(16, 5, 0, 0);
  items.push({
    id: "reminder-sent",
    kind: "reminder",
    title: "Reminder email sent",
    detail: "Preview activity — reminder delivery is not tracked yet.",
    occurredAt: yesterday.toISOString(),
    isPlaceholder: true,
  });

  // Earlier weekday: poster / cover
  const earlier = new Date(now);
  earlier.setDate(now.getDate() - 3);
  earlier.setHours(14, 40, 0, 0);
  if (input.event.event_photo_url) {
    items.push({
      id: "poster-uploaded",
      kind: "photo",
      title: "Poster uploaded",
      detail: "Cover photo is live on the event card.",
      occurredAt: earlier.toISOString(),
      isPlaceholder: false,
    });
  } else {
    items.push({
      id: "poster-placeholder",
      kind: "photo",
      title: "Poster uploaded",
      detail: "Sample: upload a cover photo to replace this placeholder.",
      occurredAt: earlier.toISOString(),
      isPlaceholder: true,
    });
  }

  // Schedule confirmed (anchored near event create-ish using starts_at offset placeholder)
  const scheduleAt = new Date(now);
  scheduleAt.setDate(now.getDate() - 4);
  scheduleAt.setHours(10, 15, 0, 0);
  items.push({
    id: "schedule-set",
    kind: "schedule",
    title: "Date & time confirmed",
    detail: "Event schedule is set on the manage page.",
    occurredAt: scheduleAt.toISOString(),
    isPlaceholder: true,
  });

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
