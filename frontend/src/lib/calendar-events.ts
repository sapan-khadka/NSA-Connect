import { toLocalIsoDate } from "./calendar";
import { EVENT_TYPE_LABELS, type EventType } from "./event-types";

export type CalendarEventInput = {
  id?: number;
  name?: string;
  starts_at: string;
  event_type: EventType;
};

export type CalendarDayEvent = {
  id: number | string;
  name: string;
  event_type: EventType;
};

function eventDisplayName(event: CalendarEventInput): string {
  const name = event.name?.trim();
  return name && name.length > 0 ? name : EVENT_TYPE_LABELS[event.event_type];
}

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

/** Events for each local calendar day, in start-time order. */
export function groupEventsByDate(
  events: CalendarEventInput[],
): Map<string, CalendarDayEvent[]> {
  const byDate = new Map<string, CalendarDayEvent[]>();

  for (const [index, event] of events.entries()) {
    const isoDate = toLocalIsoDate(new Date(event.starts_at));
    const list = byDate.get(isoDate) ?? [];
    list.push({
      id: event.id ?? `${isoDate}-${index}`,
      name: eventDisplayName(event),
      event_type: event.event_type,
    });
    byDate.set(isoDate, list);
  }

  return byDate;
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

/** Event counts per calendar month (0–11) within a year. */
export function groupEventCountsByMonth(
  events: CalendarEventInput[],
  year: number,
): Map<number, number> {
  const byMonth = new Map<number, number>();

  for (const event of events) {
    const date = new Date(event.starts_at);
    if (date.getFullYear() !== year) {
      continue;
    }
    const month = date.getMonth();
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  }

  return byMonth;
}
