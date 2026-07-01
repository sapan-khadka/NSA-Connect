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
    return "bg-surface-muted text-foreground";
  }
  if (event.is_finance_grace_period) {
    return "bg-urgent/30 text-foreground";
  }
  return "bg-mint text-primary";
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
