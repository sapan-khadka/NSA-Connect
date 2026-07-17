import { Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useDismissibleMenu } from "../design-system";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { useAuth } from "../context/useAuth";
import {
  memberMatchesMajors,
  uniqueNormalizedMajors,
} from "../lib/member-majors";
import { memberMatchesSearch } from "../lib/member-search";
import {
  fetchMembers,
  fetchTalentOptions,
} from "../lib/members-api";
import {
  formatTalentFilterSummary,
  MEMBER_TALENTS,
  memberHasAnyTalent,
  MEMBER_TALENT_LABELS,
} from "../lib/member-talents";
import { isRoleAtLeast } from "../lib/roles";

import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { InviteToEventModal } from "./InviteToEventModal";
import { MemberDirectoryRow } from "./MemberDirectoryCard";

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
const SEARCH_FETCH_PAGE_SIZE = 100;

const FILTER_CHIP_BASE =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full border px-2.5 py-1.5 text-center text-xs font-medium leading-snug whitespace-normal transition-colors";

function filterChipClass(active: boolean): string {
  return [
    FILTER_CHIP_BASE,
    active
      ? "border-primary bg-primary text-white"
      : "border-gray-200 bg-white text-label hover:text-foreground",
  ].join(" ");
}

function toggleValue<T extends string | number>(current: T[], value: T): T[] {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

export function MemberDirectory() {
  const { member: currentMember } = useAuth();
  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTalents, setSelectedTalents] = useState<string[]>([]);
  const [selectedMajors, setSelectedMajors] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [facetMajors, setFacetMajors] = useState<string[]>([]);
  const [facetYears, setFacetYears] = useState<number[]>([]);
  const [talentLabels, setTalentLabels] = useState<Record<string, string>>(
    MEMBER_TALENT_LABELS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const {
    open: filtersOpen,
    setOpen: setFiltersOpen,
    rootRef: filtersRootRef,
    menuId: filtersMenuId,
  } = useDismissibleMenu();

  const isBoard = currentMember ? isRoleAtLeast(currentMember.role, "board") : false;
  const canInvite = isBoard && selectedTalents.length > 0;
  const activeFilterCount =
    selectedTalents.length + selectedMajors.length + selectedYears.length;
  const hasClientFilters =
    selectedMajors.length > 0 || selectedYears.length > 0;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    void fetchTalentOptions()
      .then((response) => {
        if (response.labels && Object.keys(response.labels).length > 0) {
          setTalentLabels({ ...MEMBER_TALENT_LABELS, ...response.labels });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetchMembers({ page: 1, page_size: SEARCH_FETCH_PAGE_SIZE })
      .then((data) => {
        setFacetMajors(
          uniqueNormalizedMajors(data.members.map((member) => member.major)),
        );
        const years = [
          ...new Set(data.members.map((member) => member.graduation_year)),
        ].sort((a, b) => b - a);
        setFacetYears(years);
      })
      .catch(() => undefined);
  }, []);

  const isSearching = debouncedSearch.trim().length > 0;
  const useClientResultSet = isSearching || hasClientFilters;

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchMembers({
        page: useClientResultSet ? 1 : page,
        page_size: useClientResultSet ? SEARCH_FETCH_PAGE_SIZE : pageSize,
        talents: selectedTalents.length > 0 ? selectedTalents : undefined,
      });
      setMembers(data.members);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
    }
  }, [useClientResultSet, page, pageSize, selectedTalents]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const visibleMembers = useMemo(() => {
    let result = members;

    // Within talents/majors/years: OR. Across sections: AND.
    if (selectedTalents.length > 0) {
      result = result.filter((member) =>
        memberHasAnyTalent(member, selectedTalents),
      );
    }

    if (selectedMajors.length > 0) {
      result = result.filter((member) =>
        memberMatchesMajors(member, selectedMajors),
      );
    }

    if (selectedYears.length > 0) {
      result = result.filter((member) =>
        selectedYears.includes(member.graduation_year),
      );
    }

    if (isSearching) {
      result = result.filter((member) =>
        memberMatchesSearch(member, debouncedSearch),
      );
    }

    return result;
  }, [
    debouncedSearch,
    isSearching,
    members,
    selectedMajors,
    selectedTalents,
    selectedYears,
  ]);

  const filteredCount = useClientResultSet ? visibleMembers.length : total;

  const filterSummary =
    selectedTalents.length > 0
      ? formatTalentFilterSummary(selectedTalents, filteredCount, talentLabels)
      : activeFilterCount > 0
        ? `Showing ${filteredCount} member${filteredCount === 1 ? "" : "s"}`
        : null;

  function clearAllFilters() {
    setSelectedTalents([]);
    setSelectedMajors([]);
    setSelectedYears([]);
    setPage(1);
  }

  return (
    <Card padding="none" className="ds-mobile-edge-directory overflow-visible">
      <div className="relative z-10 border-b border-gray-200 px-4 py-4 lg:px-6 lg:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-light tracking-subhead text-foreground">
              Member directory
            </h2>
            <p className="mt-1 text-sm text-label">
              {filterSummary ??
                `${filteredCount} member${filteredCount === 1 ? "" : "s"}`}
            </p>
            {activeFilterCount > 0 ? (
              <p className="mt-1 text-xs text-label">
                Within each section, any match counts (OR). Across sections,
                members must match every active section (AND).
              </p>
            ) : null}
          </div>

          <div className="flex w-full items-center gap-2 lg:max-w-md">
            <div ref={filtersRootRef} className="relative shrink-0">
              <button
                type="button"
                aria-expanded={filtersOpen}
                aria-haspopup="dialog"
                aria-controls={filtersMenuId}
                onClick={() => setFiltersOpen((current) => !current)}
                className={[
                  "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition",
                  activeFilterCount > 0 || filtersOpen
                    ? "border-primary/40 bg-badge-teal-bg text-primary"
                    : "border-gray-300 bg-white text-foreground hover:bg-gray-50",
                ].join(" ")}
              >
                <AppIcon icon={Filter} size="sm" className="text-current" />
                <span>
                  {activeFilterCount > 0
                    ? `Filters · ${activeFilterCount}`
                    : "Filters"}
                </span>
              </button>

              {filtersOpen ? (
                <div
                  id={filtersMenuId}
                  role="dialog"
                  aria-label="Member filters"
                  className="absolute left-0 top-full z-20 mt-2 flex w-[min(24rem,calc(100vw-2rem))] max-h-[min(28rem,70vh)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg sm:w-96"
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground">Filters</p>
                    {activeFilterCount > 0 ? (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        Clear all
                      </button>
                    ) : null}
                  </div>

                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
                    <section>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                        Talents
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {MEMBER_TALENTS.map((talent) => {
                          const active = selectedTalents.includes(talent);
                          return (
                            <button
                              key={talent}
                              type="button"
                              aria-pressed={active}
                              onClick={() => {
                                setSelectedTalents((current) =>
                                  toggleValue(current, talent),
                                );
                                setPage(1);
                              }}
                              className={filterChipClass(active)}
                            >
                              {talentLabels[talent] ?? talent}
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {facetMajors.length > 0 ? (
                      <section>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                          Major
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {facetMajors.map((major) => {
                            const active = selectedMajors.includes(major);
                            return (
                              <button
                                key={major}
                                type="button"
                                aria-pressed={active}
                                onClick={() => {
                                  setSelectedMajors((current) =>
                                    toggleValue(current, major),
                                  );
                                  setPage(1);
                                }}
                                className={filterChipClass(active)}
                              >
                                {major}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}

                    {facetYears.length > 0 ? (
                      <section>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                          Class year
                        </p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {facetYears.map((year) => {
                            const active = selectedYears.includes(year);
                            return (
                              <button
                                key={year}
                                type="button"
                                aria-pressed={active}
                                onClick={() => {
                                  setSelectedYears((current) =>
                                    toggleValue(current, year),
                                  );
                                  setPage(1);
                                }}
                                className={filterChipClass(active)}
                              >
                                {year}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <label className="block min-w-0 flex-1">
              <span className="sr-only">Search members</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, major, interests..."
                className="w-full rounded-md border border-gray-300 px-3 py-3 text-base text-foreground placeholder:text-label focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:py-2 sm:text-sm"
              />
            </label>
          </div>
        </div>

        {canInvite ? (
          <div className="mt-4">
            <Button
              type="button"
              onClick={() => setInviteOpen(true)}
              size="lg"
            >
              Invite to event
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <div className="ds-mobile-edge-section ds-alert-banner lg:mx-6 lg:mt-4">{error}</div> : null}

      <div className="px-0 py-0">
        {isLoading ? (
          <p className="px-4 py-4 text-sm text-label lg:px-6">Loading members...</p>
        ) : visibleMembers.length === 0 ? (
          <p className="px-4 py-4 text-sm text-label lg:px-6">
            {activeFilterCount > 0 && !isSearching
              ? "No members match the selected filters."
              : isSearching
                ? "No members match your search."
                : "No members found."}
          </p>
        ) : (
          <div>
            <div
              className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 border-b border-gray-100 px-4 py-2 sm:grid lg:px-6"
              aria-hidden="true"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Name
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Major / Year
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Talents
              </span>
              <span className="text-right text-xs font-medium uppercase tracking-wide text-gray-400">
                Email
              </span>
              <span className="w-5" />
            </div>
            <div className="divide-y divide-gray-100">
              {visibleMembers.map((member) => (
                <MemberDirectoryRow
                  key={member.id}
                  member={member}
                  to={`/members/${member.id}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {!useClientResultSet && totalPages > 1 ? (
        <div className="flex flex-col gap-4 border-t border-gray-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex items-center gap-2 text-sm text-label">
            <label htmlFor="page-size" className="font-medium text-foreground">
              Members per page
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <p className="text-sm text-label">
              Page {page} of {totalPages}
            </p>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || isLoading}
              className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || isLoading}
              className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <InviteToEventModal
        open={inviteOpen}
        memberIds={visibleMembers.map((member) => member.id)}
        onClose={() => setInviteOpen(false)}
      />
    </Card>
  );
}
