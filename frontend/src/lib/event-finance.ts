import { formatEventDateTime } from "./format-datetime";
import type { EventResponse } from "./events-api";

export function formatFinanceLockDeadline(isoDate: string): string {
  return formatEventDateTime(isoDate);
}

export function getEventFinanceStatusLabel(event: EventResponse): string {
  if (event.is_finance_locked) {
    return "Finances closed";
  }
  if (event.is_finance_grace_period) {
    return "Close-out window";
  }
  if (event.is_past) {
    return "Past event";
  }
  return "Open";
}

export function getEventFinanceStatusClass(event: EventResponse): string {
  if (event.is_finance_locked) {
    return "border-gray-200 bg-gray-100 text-gray-700";
  }
  if (event.is_finance_grace_period) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

export function isEventFinanceEditable(event: Pick<EventResponse, "is_finance_locked">): boolean {
  return !event.is_finance_locked;
}

export function getFinanceCloseoutMessage(event: EventResponse): string | null {
  if (event.is_finance_grace_period) {
    return `Log or edit entries until ${formatFinanceLockDeadline(event.finance_lock_at)}. After that, this event's finances close automatically for accountability.`;
  }
  if (event.is_finance_locked) {
    return "This event's finances are closed. Entries are read-only and preserved in the archive.";
  }
  return null;
}
