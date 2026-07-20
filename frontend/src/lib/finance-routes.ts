export type FinanceTab = "pulse" | "inbox" | "books" | "dues";

export const FINANCE_PATH = "/finance";
/** Deep link into the finance inbox (approvals + alerts). Legacy `?tab=approvals` still resolves. */
export const FINANCE_APPROVALS_PATH = "/finance?tab=inbox";
export const FINANCE_INBOX_PATH = FINANCE_APPROVALS_PATH;
export const FINANCE_TRANSACTIONS_PATH = "/finance?tab=books";
export const FINANCE_BOOKS_PATH = FINANCE_TRANSACTIONS_PATH;
export const FINANCE_DUES_PATH = "/finance?tab=dues";

export function parseFinanceTab(value: string | null): FinanceTab {
  if (value === "inbox" || value === "approvals") {
    return "inbox";
  }

  if (value === "books" || value === "transactions") {
    return "books";
  }

  if (value === "dues") {
    return "dues";
  }

  // `pulse`, `overview`, null, and unknown values all land on Pulse.
  return "pulse";
}

export function parseFinanceEventId(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function financeTabSearchParams(
  tab: FinanceTab,
  options?: { eventId?: number | null },
): Record<string, string> {
  const params: Record<string, string> = {};

  if (tab !== "pulse") {
    params.tab = tab;
  }

  if (tab === "books" && options?.eventId != null && options.eventId > 0) {
    params.event_id = String(options.eventId);
  }

  return params;
}

/** Deep link into Books, optionally scoped to one event. */
export function financeBooksPath(eventId?: number | null): string {
  if (eventId == null || eventId <= 0) {
    return FINANCE_BOOKS_PATH;
  }

  return `/finance?tab=books&event_id=${eventId}`;
}
