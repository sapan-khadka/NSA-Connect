import { toLocalIsoDate, startOfLocalDay as startOfDay } from "./calendar";
import type { EventResponse } from "./events-api";

export type UpcomingUrgencyGroup =
  | "this_week"
  | "this_month"
  | "next_3_months"
  | "later";

export const UPCOMING_GROUP_LABELS: Record<UpcomingUrgencyGroup, string> = {
  this_week: "This week",
  this_month: "This month",
  next_3_months: "Next 3 months",
  later: "Later",
};

export const UPCOMING_GROUP_ORDER: UpcomingUrgencyGroup[] = [
  "this_week",
  "this_month",
  "next_3_months",
  "later",
];

function endOfWeek(date: Date): Date {
  const day = date.getDay();
  const daysUntilSaturday = 6 - day;
  const end = new Date(date);
  end.setDate(end.getDate() + daysUntilSaturday);
  end.setHours(23, 59, 59, 999);
  return end;
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addCalendarMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

export function classifyUpcomingEvent(
  startsAt: string,
  now: Date = new Date(),
): UpcomingUrgencyGroup {
  const eventDate = startOfDay(new Date(startsAt));
  const today = startOfDay(now);

  if (eventDate < today) {
    return "later";
  }

  const weekEnd = endOfWeek(today);
  if (eventDate <= weekEnd) {
    return "this_week";
  }

  const monthEnd = endOfMonth(today);
  if (eventDate <= monthEnd) {
    return "this_month";
  }

  const threeMonthsOut = endOfMonth(addCalendarMonths(today, 3));
  if (eventDate <= threeMonthsOut) {
    return "next_3_months";
  }

  return "later";
}

/**
 * Same selector as Home “Next: …” / Upcoming Events KPI —
 * first upcoming non-meeting event from `fetchUpcomingEvents` results.
 */
export function findNextNonMeetingEvent(
  events: EventResponse[],
): EventResponse | null {
  return events.find((event) => event.event_type !== "meeting") ?? null;
}

export function groupUpcomingEvents(
  events: EventResponse[],
  now: Date = new Date(),
): Record<UpcomingUrgencyGroup, EventResponse[]> {
  const groups: Record<UpcomingUrgencyGroup, EventResponse[]> = {
    this_week: [],
    this_month: [],
    next_3_months: [],
    later: [],
  };

  const todayIso = toLocalIsoDate(now);
  const upcoming = events
    .filter((event) => toLocalIsoDate(new Date(event.starts_at)) >= todayIso)
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    );

  for (const event of upcoming) {
    groups[classifyUpcomingEvent(event.starts_at, now)].push(event);
  }

  return groups;
}
