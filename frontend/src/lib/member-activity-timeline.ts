/**
 * Member profile activity timeline helpers.
 * Groups events by day for a readable feed. No backend activity API yet —
 * callers pass normalized items (or an empty list for the empty state).
 */

import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CalendarCheck2,
  CheckCircle2,
  UserPlus,
  Users,
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
  assigned_committee: Users,
};

export const MEMBER_ACTIVITY_TITLES: Record<MemberActivityKind, string> = {
  joined: "Joined organization",
  paid_dues: "Paid dues",
  attended_event: "Attended event",
  completed_task: "Completed task",
  assigned_committee: "Assigned committee",
};

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
