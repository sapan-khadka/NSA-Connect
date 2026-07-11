import type { Announcement } from "./announcements-api";
import type { MemberResponse } from "./auth-api";
import { calendarDeepLink, eventDetailPath } from "./event-links";
import type { EventResponse } from "./events-api";
import type { FinanceEntryResponse } from "./finance-api";
import { memberMatchesSearch } from "./member-search";

export type GlobalSearchCategory =
  | "member"
  | "event"
  | "announcement"
  | "transaction";

export type GlobalSearchResult = {
  id: string;
  category: GlobalSearchCategory;
  title: string;
  subtitle?: string;
  to: string;
};

export type GlobalSearchIndex = {
  members: MemberResponse[];
  events: EventResponse[];
  announcements: Announcement[];
  transactions: FinanceEntryResponse[];
};

const CATEGORY_LABEL: Record<GlobalSearchCategory, string> = {
  member: "Members",
  event: "Events",
  announcement: "Announcements",
  transaction: "Transactions",
};

export function globalSearchCategoryLabel(
  category: GlobalSearchCategory,
): string {
  return CATEGORY_LABEL[category];
}

function includesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query);
}

export function filterGlobalSearch(
  index: GlobalSearchIndex,
  rawQuery: string,
  limits: Partial<Record<GlobalSearchCategory, number>> = {},
): GlobalSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return [];
  }

  const memberLimit = limits.member ?? 5;
  const eventLimit = limits.event ?? 5;
  const announcementLimit = limits.announcement ?? 5;
  const transactionLimit = limits.transaction ?? 5;

  const members = index.members
    .filter((member) => memberMatchesSearch(member, query))
    .slice(0, memberLimit)
    .map((member) => ({
      id: `member-${member.id}`,
      category: "member" as const,
      title: member.full_name,
      subtitle: [member.major, member.role].filter(Boolean).join(" · "),
      to: `/members/${member.id}`,
    }));

  const events = index.events
    .filter((event) => {
      const blob = [
        event.name,
        event.description ?? "",
        event.location ?? "",
        event.event_type,
      ].join(" ");
      return includesQuery(blob, query);
    })
    .slice(0, eventLimit)
    .map((event) => ({
      id: `event-${event.id}`,
      category: "event" as const,
      title: event.name,
      subtitle: event.location ?? event.event_type,
      to: calendarDeepLink(event) || eventDetailPath(event.id),
    }));

  const announcements = index.announcements
    .filter((item) => {
      const blob = [item.title, item.body, item.category].join(" ");
      return includesQuery(blob, query);
    })
    .slice(0, announcementLimit)
    .map((item) => ({
      id: `announcement-${item.id}`,
      category: "announcement" as const,
      title: item.title,
      subtitle: CATEGORY_LABEL.announcement,
      to: "/announcements",
    }));

  const transactions = index.transactions
    .filter((entry) => {
      const blob = [
        entry.description ?? "",
        entry.category,
        entry.entry_type,
        entry.amount,
      ].join(" ");
      return includesQuery(blob, query);
    })
    .slice(0, transactionLimit)
    .map((entry) => ({
      id: `transaction-${entry.id}`,
      category: "transaction" as const,
      title: entry.description?.trim() || entry.category,
      subtitle: `${entry.entry_type} · ${entry.amount}`,
      to: "/finance",
    }));

  return [...members, ...events, ...announcements, ...transactions];
}

export function groupGlobalSearchResults(
  results: GlobalSearchResult[],
): Array<{ category: GlobalSearchCategory; items: GlobalSearchResult[] }> {
  const order: GlobalSearchCategory[] = [
    "member",
    "event",
    "announcement",
    "transaction",
  ];
  return order
    .map((category) => ({
      category,
      items: results.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);
}
