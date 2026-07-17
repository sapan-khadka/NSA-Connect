/**
 * Member profile Recent Activity helpers.
 *
 * Feed types returned by GET /v1/members/{id}/activity (real timestamps only):
 *   task_completed | dues_paid | event_checkin
 *
 * Deferred — no audit trail exists yet (do not invent in the UI):
 *   - RSVP status changes
 *   - role / status / position changes
 *   - joined / committee assignment history
 */

import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CalendarCheck2,
  CheckCircle2,
} from "lucide-react";

import {
  formatActivityDayLabel,
  formatActivityTimeLabel,
} from "./event-activity-timeline";
import { toLocalIsoDate } from "./calendar";

export type MemberActivityKind =
  | "task_completed"
  | "dues_paid"
  | "event_checkin";

export type MemberActivityItem = {
  id: string;
  kind: MemberActivityKind;
  title: string;
  detail?: string;
  occurredAt: string;
  taskId?: number | null;
  eventId?: number | null;
  duesRecordId?: number | null;
  href?: string | null;
};

export type MemberActivityDayGroup = {
  key: string;
  label: string;
  items: MemberActivityItem[];
};

export type MemberActivityApiType = MemberActivityKind;

export type MemberActivityApiItem = {
  id: string;
  type: MemberActivityApiType;
  description: string;
  timestamp: string;
  task_id: number | null;
  event_id: number | null;
  dues_record_id: number | null;
};

export type MemberActivityListResponse = {
  items: MemberActivityApiItem[];
  total: number;
};

export const MEMBER_ACTIVITY_ICONS: Record<MemberActivityKind, LucideIcon> = {
  task_completed: CheckCircle2,
  dues_paid: Banknote,
  event_checkin: CalendarCheck2,
};

/** Short label for icons / empty-state chips. */
export const MEMBER_ACTIVITY_TITLES: Record<MemberActivityKind, string> = {
  task_completed: "Task completed",
  dues_paid: "Dues paid",
  event_checkin: "Event check-in",
};

export const MEMBER_ACTIVITY_KINDS: MemberActivityKind[] = [
  "task_completed",
  "dues_paid",
  "event_checkin",
];

export const MEMBER_ACTIVITY_PREVIEW_LIMIT = 6;

export function createMemberActivityItem(
  partial: Omit<MemberActivityItem, "title"> & { title?: string },
): MemberActivityItem {
  return {
    ...partial,
    title: partial.title ?? MEMBER_ACTIVITY_TITLES[partial.kind],
  };
}

function activityHref(item: MemberActivityApiItem): string | null {
  if (item.event_id != null) {
    return `/events/${item.event_id}`;
  }
  return null;
}

export function mapMemberActivityApiItem(
  item: MemberActivityApiItem,
): MemberActivityItem {
  return {
    id: item.id,
    kind: item.type,
    title: item.description,
    occurredAt: item.timestamp,
    taskId: item.task_id,
    eventId: item.event_id,
    duesRecordId: item.dues_record_id,
    href: activityHref(item),
  };
}

export function sortMemberActivityItems(
  items: MemberActivityItem[],
): MemberActivityItem[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

export function takeMemberActivityPreview(
  items: MemberActivityItem[],
  limit = MEMBER_ACTIVITY_PREVIEW_LIMIT,
): { preview: MemberActivityItem[]; hasMore: boolean; total: number } {
  const sorted = sortMemberActivityItems(items);
  return {
    preview: sorted.slice(0, limit),
    hasMore: sorted.length > limit,
    total: sorted.length,
  };
}

function dayKey(iso: string): string {
  return toLocalIsoDate(new Date(iso));
}

export function groupMemberActivityByDay(
  items: MemberActivityItem[],
  now = new Date(),
): MemberActivityDayGroup[] {
  const groups = new Map<string, MemberActivityDayGroup>();

  for (const item of sortMemberActivityItems(items)) {
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

  return [...groups.values()];
}

export { formatActivityDayLabel, formatActivityTimeLabel };
