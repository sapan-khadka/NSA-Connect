import { toLocalIsoDate } from "./calendar";
import type { EventType } from "./event-types";

export type CalendarEventInput = {
  starts_at: string;
  event_type: EventType;
};

/** Group unique event types per local calendar day. */
export function groupEventTypesByDate(
  events: CalendarEventInput[],
): Map<string, EventType[]> {
  const byDate = new Map<string, Set<EventType>>();

  for (const event of events) {
    const isoDate = toLocalIsoDate(new Date(event.starts_at));
    const types = byDate.get(isoDate) ?? new Set<EventType>();
    types.add(event.event_type);
    byDate.set(isoDate, types);
  }

  const result = new Map<string, EventType[]>();
  for (const [isoDate, types] of byDate) {
    result.set(isoDate, [...types].sort());
  }
  return result;
}

export function formatMonthQuery(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Unique event types per calendar month (0–11) within a year. */
export function groupEventTypesByMonth(
  events: CalendarEventInput[],
  year: number,
): Map<number, EventType[]> {
  const byMonth = new Map<number, Set<EventType>>();

  for (const event of events) {
    const date = new Date(event.starts_at);
    if (date.getFullYear() !== year) {
      continue;
    }

    const month = date.getMonth();
    const types = byMonth.get(month) ?? new Set<EventType>();
    types.add(event.event_type);
    byMonth.set(month, types);
  }

  const result = new Map<number, EventType[]>();
  for (const [month, types] of byMonth) {
    result.set(month, [...types].sort());
  }

  return result;
}
