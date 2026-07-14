/**
 * Member profile activity timeline helpers.
 * Groups events by day for a readable feed. No backend activity API yet —
 * callers pass normalized items, use placeholders for demos, or empty for empty state.
 */

import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CalendarCheck2,
  CheckCircle2,
  UserPlus,
  UsersRound,
} from "lucide-react";

import {
  formatActivityDayLabel,
  formatActivityTimeLabel,
} from "./event-activity-timeline";

export type MemberActivityKind =
  | "joined"
  | "paid_dues"
  | "attended_event"
  | "completed_task"
  | "assigned_committee";

export type MemberActivityItem = {
  id: string;
  kind: MemberActivityKind;
  title: string;
  detail?: string;
  occurredAt: string;
};

export type MemberActivityDayGroup = {
  key: string;
  label: string;
  items: MemberActivityItem[];
};

export const MEMBER_ACTIVITY_ICONS: Record<MemberActivityKind, LucideIcon> = {
  joined: UserPlus,
  paid_dues: Banknote,
  attended_event: CalendarCheck2,
  completed_task: CheckCircle2,
  assigned_committee: UsersRound,
};

/** Canonical event titles — match product copy. */
export const MEMBER_ACTIVITY_TITLES: Record<MemberActivityKind, string> = {
  joined: "Joined",
  paid_dues: "Paid dues",
  attended_event: "Attended event",
  completed_task: "Completed task",
  assigned_committee: "Assigned committee",
};

export const MEMBER_ACTIVITY_KINDS: MemberActivityKind[] = [
  "joined",
  "paid_dues",
  "attended_event",
  "completed_task",
  "assigned_committee",
];

export function createMemberActivityItem(
  partial: Omit<MemberActivityItem, "title"> & { title?: string },
): MemberActivityItem {
  return {
    ...partial,
    title: partial.title ?? MEMBER_ACTIVITY_TITLES[partial.kind],
  };
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(iso: string): string {
  const local = startOfLocalDay(new Date(iso));
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function atLocalDaysAgo(now: Date, daysAgo: number, hour: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, daysAgo === 0 ? 20 : 0, 0, 0);
  return date.toISOString();
}

/**
 * Demo timeline covering every supported event type, grouped across days.
 * Used when real activity data is not available yet.
 */
export function buildPlaceholderMemberActivity(
  now = new Date(),
): MemberActivityItem[] {
  return [
    createMemberActivityItem({
      id: "ph-task",
      kind: "completed_task",
      detail: "Finalize spring mixer checklist",
      occurredAt: atLocalDaysAgo(now, 0, 14),
    }),
    createMemberActivityItem({
      id: "ph-event",
      kind: "attended_event",
      detail: "Cultural Night · Student Center",
      occurredAt: atLocalDaysAgo(now, 0, 10),
    }),
    createMemberActivityItem({
      id: "ph-dues",
      kind: "paid_dues",
      detail: "Fall semester membership",
      occurredAt: atLocalDaysAgo(now, 1, 16),
    }),
    createMemberActivityItem({
      id: "ph-committee",
      kind: "assigned_committee",
      detail: "Events committee",
      occurredAt: atLocalDaysAgo(now, 3, 11),
    }),
    createMemberActivityItem({
      id: "ph-joined",
      kind: "joined",
      detail: "Welcome to CampusOS",
      occurredAt: atLocalDaysAgo(now, 18, 12),
    }),
  ];
}

export function sortMemberActivityItems(
  items: MemberActivityItem[],
): MemberActivityItem[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
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
