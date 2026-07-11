import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAnnouncements } from "../lib/announcements-api";
import { getApiErrorMessage } from "../lib/api-error";
import { fetchUpcomingEvents, fetchEvents } from "../lib/events-api";
import { fetchFinanceEntries } from "../lib/finance-api";
import {
  filterGlobalSearch,
  groupGlobalSearchResults,
  type GlobalSearchIndex,
  type GlobalSearchResult,
} from "../lib/global-search";
import { formatMonthQuery } from "../lib/calendar-events";
import { fetchMembers } from "../lib/members-api";
import {
  clearRecentSearches,
  readRecentSearches,
  writeRecentSearch,
} from "../lib/recent-searches";

const EMPTY_INDEX: GlobalSearchIndex = {
  members: [],
  events: [],
  announcements: [],
  transactions: [],
};

type UseGlobalSearchOptions = {
  open: boolean;
  includeFinance: boolean;
  includeMembers: boolean;
};

export function useGlobalSearch({
  open,
  includeFinance,
  includeMembers,
}: UseGlobalSearchOptions) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [index, setIndex] = useState<GlobalSearchIndex>(EMPTY_INDEX);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readRecentSearches(),
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function loadIndex() {
      setLoading(true);
      setError(null);

      const now = new Date();
      const month = formatMonthQuery(now.getFullYear(), now.getMonth());

      try {
        const [membersResult, upcomingResult, monthResult, announcementsResult, financeResult] =
          await Promise.allSettled([
            includeMembers
              ? fetchMembers({ page: 1, page_size: 100, status: "approved" })
              : Promise.resolve({ members: [] }),
            fetchUpcomingEvents({ limit: 100 }),
            fetchEvents({ month }),
            fetchAnnouncements(),
            includeFinance
              ? fetchFinanceEntries()
              : Promise.resolve({ entries: [] }),
          ]);

        if (cancelled) {
          return;
        }

        const members =
          membersResult.status === "fulfilled"
            ? membersResult.value.members
            : [];
        const upcoming =
          upcomingResult.status === "fulfilled"
            ? upcomingResult.value.events
            : [];
        const monthEvents =
          monthResult.status === "fulfilled" ? monthResult.value.events : [];
        const announcements =
          announcementsResult.status === "fulfilled"
            ? announcementsResult.value.announcements
            : [];
        const transactions =
          financeResult.status === "fulfilled"
            ? financeResult.value.entries
            : [];

        const eventMap = new Map<number, (typeof upcoming)[number]>();
        for (const event of [...upcoming, ...monthEvents]) {
          eventMap.set(event.id, event);
        }

        setIndex({
          members,
          events: Array.from(eventMap.values()),
          announcements,
          transactions,
        });

        const anyRejected = [
          membersResult,
          upcomingResult,
          monthResult,
          announcementsResult,
          financeResult,
        ].some((result) => result.status === "rejected");

        if (anyRejected && members.length + eventMap.size + announcements.length === 0) {
          const firstReject = [
            membersResult,
            upcomingResult,
            monthResult,
            announcementsResult,
            financeResult,
          ].find((result) => result.status === "rejected");
          if (firstReject && firstReject.status === "rejected") {
            setError(getApiErrorMessage(firstReject.reason, "Unable to load search data."));
          }
        }
      } catch (caught) {
        if (!cancelled) {
          setError(getApiErrorMessage(caught, "Unable to load search data."));
          setIndex(EMPTY_INDEX);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadIndex();

    return () => {
      cancelled = true;
    };
  }, [open, includeFinance, includeMembers]);

  const results = useMemo(
    () => filterGlobalSearch(index, debouncedQuery),
    [index, debouncedQuery],
  );

  const grouped = useMemo(
    () => groupGlobalSearchResults(results),
    [results],
  );

  const remember = useCallback((value: string) => {
    setRecent(writeRecentSearch(value));
  }, []);

  const clearRecent = useCallback(() => {
    clearRecentSearches();
    setRecent([]);
  }, []);

  const resetQuery = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    results,
    grouped,
    loading,
    error,
    recent,
    remember,
    clearRecent,
    resetQuery,
  };
}

export type { GlobalSearchResult };
