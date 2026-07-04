import { useCallback, useEffect, useMemo, useState } from "react";

import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/auth-api";
import { useAuth } from "../context/useAuth";
import { memberMatchesSearch } from "../lib/member-search";
import {
  fetchMembers,
  fetchTalentOptions,
} from "../lib/members-api";
import {
  formatTalentFilterSummary,
  MEMBER_TALENT_LABELS,
  type MemberTalent,
} from "../lib/member-talents";
import { canViewMemberDirectory, isRoleAtLeast } from "../lib/roles";

import { InviteToEventModal } from "./InviteToEventModal";
import { MemberDirectoryCard } from "./MemberDirectoryCard";

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
const SEARCH_FETCH_PAGE_SIZE = 100;

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
  const [talentLabels, setTalentLabels] = useState<Record<string, string>>(
    MEMBER_TALENT_LABELS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isBoard = currentMember ? isRoleAtLeast(currentMember.role, "board") : false;
  const canInvite = isBoard && selectedTalents.length > 0;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    void fetchTalentOptions()
      .then((response) => setTalentLabels(response.labels))
      .catch(() => undefined);
  }, []);

  const isSearching = debouncedSearch.trim().length > 0;

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchMembers({
        page: isSearching ? 1 : page,
        page_size: isSearching ? SEARCH_FETCH_PAGE_SIZE : pageSize,
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
  }, [isSearching, page, pageSize, selectedTalents]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const visibleMembers = useMemo(
    () =>
      isSearching
        ? members.filter((member) =>
            memberMatchesSearch(member, debouncedSearch),
          )
        : members,
    [debouncedSearch, isSearching, members],
  );

  const filterSummary =
    selectedTalents.length > 0
      ? formatTalentFilterSummary(selectedTalents, isSearching ? visibleMembers.length : total)
      : null;

  function toggleTalent(talent: string) {
    setSelectedTalents((current) =>
      current.includes(talent)
        ? current.filter((item) => item !== talent)
        : [...current, talent],
    );
    setPage(1);
  }

  function clearTalentFilter() {
    setSelectedTalents([]);
    setPage(1);
  }

  return (
    <section className="ds-card">
      <div className="border-b border-gray-200 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-light tracking-subhead text-foreground">
              Member directory
            </h2>
            <p className="mt-1 text-sm text-label">
              {filterSummary ??
                `${isSearching ? visibleMembers.length : total} member${
                  (isSearching ? visibleMembers.length : total) === 1 ? "" : "s"
                }`}
            </p>
            {selectedTalents.length > 0 ? (
              <p className="mt-1 text-xs text-label">
                Talent filter uses any-match (OR) — members with at least one selected talent.
              </p>
            ) : null}
          </div>

          <label className="block w-full lg:max-w-sm">
            <span className="sr-only">Search members</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, major, interests..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground placeholder:text-label focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(Object.keys(talentLabels) as MemberTalent[]).map((talent) => {
            const active = selectedTalents.includes(talent);
            return (
              <button
                key={talent}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTalent(talent)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "border border-gray-200 bg-white text-label hover:text-foreground",
                ].join(" ")}
              >
                {talentLabels[talent] ?? talent}
              </button>
            );
          })}
          {selectedTalents.length > 0 ? (
            <button
              type="button"
              onClick={clearTalentFilter}
              className="rounded-full px-3 py-1 text-xs font-medium text-accent hover:underline"
            >
              Clear filter
            </button>
          ) : null}
        </div>

        {canInvite ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Invite to event
            </button>
          </div>
        ) : null}
      </div>

      {error ? <div className="mx-6 mt-4 ds-alert-banner">{error}</div> : null}

      <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <p className="text-sm text-label">Loading members...</p>
        ) : visibleMembers.length === 0 ? (
          <p className="text-sm text-label">
            {isSearching || selectedTalents.length > 0
              ? "No members match your filters."
              : "No members found."}
          </p>
        ) : (
          visibleMembers.map((member) => (
            <MemberDirectoryCard
              key={member.id}
              member={member}
              to={`/members/${member.id}`}
            />
          ))
        )}
      </div>

      {!isSearching && totalPages > 1 ? (
        <div className="flex flex-col gap-4 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-label">
            <label htmlFor="page-size" className="font-medium text-foreground">
              Cards per page
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm text-foreground"
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
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || isLoading}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
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
    </section>
  );
}
