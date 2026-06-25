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
