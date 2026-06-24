import { useCallback, useEffect, useMemo, useState } from "react";

import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/auth-api";
import { useAuth } from "../context/useAuth";
import { memberMatchesSearch } from "../lib/member-search";
import { fetchMembers, updateMemberRole } from "../lib/members-api";
import {
  canPresidentPromoteMember,
  type PromotableBoardRole,
} from "../lib/roles";

import { RoleBadge } from "./RoleBadge";
import { RolePromotionSelect } from "./RolePromotionSelect";
import { StatusBadge } from "./StatusBadge";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<number | null>(null);

  const isPresident = currentMember?.role === "president";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const isSearching = debouncedSearch.trim().length > 0;

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchMembers({
        page: isSearching ? 1 : page,
        page_size: isSearching ? SEARCH_FETCH_PAGE_SIZE : pageSize,
      });
      setMembers(data.members);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
    }
  }, [isSearching, page, pageSize]);

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

  const resultSummary = isSearching
    ? `${visibleMembers.length} match${visibleMembers.length === 1 ? "" : "es"}`
    : `${total} member${total === 1 ? "" : "s"} total`;

  function handlePageSizeChange(nextPageSize: number) {
    setPageSize(nextPageSize);
    setPage(1);
  }

  async function handleRoleChange(memberId: number, role: PromotableBoardRole) {
    setUpdatingMemberId(memberId);
    setError(null);

    try {
      const updatedMember = await updateMemberRole(memberId, { role });
      setMembers((current) =>
        current.map((member) =>
          member.id === memberId ? updatedMember : member,
        ),
      );
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      setUpdatingMemberId(null);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">Member directory</h2>
            <p className="mt-1 text-sm text-gray-500">{resultSummary}</p>
            {isPresident && (
              <p className="mt-1 text-xs text-gray-500">
                As president, you can promote general members to board or demote
                board members to general.
              </p>
            )}
          </div>

          <label className="block w-full lg:max-w-sm">
            <span className="sr-only">Search members</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, ID, major, role..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-primary placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-semibold uppercase tracking-wide text-gray-500">
                Name
              </th>
              <th className="px-6 py-3 text-left font-semibold uppercase tracking-wide text-gray-500">
                Email
              </th>
              <th className="px-6 py-3 text-left font-semibold uppercase tracking-wide text-gray-500">
                Student ID
              </th>
              <th className="px-6 py-3 text-left font-semibold uppercase tracking-wide text-gray-500">
                Major
              </th>
              <th className="px-6 py-3 text-left font-semibold uppercase tracking-wide text-gray-500">
                Graduation
              </th>
              <th className="px-6 py-3 text-left font-semibold uppercase tracking-wide text-gray-500">
                Role
              </th>
              <th className="px-6 py-3 text-left font-semibold uppercase tracking-wide text-gray-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-gray-500">
                  Loading members...
                </td>
              </tr>
            ) : visibleMembers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-gray-500">
                  {isSearching
                    ? "No members match your search."
                    : "No members found."}
                </td>
              </tr>
            ) : (
              visibleMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-primary">
                    {member.full_name}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{member.email}</td>
                  <td className="px-6 py-4 text-gray-600">{member.student_id}</td>
                  <td className="px-6 py-4 text-gray-600">{member.major}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {member.graduation_year}
                  </td>
                  <td className="px-6 py-4">
                    {isPresident &&
                    currentMember &&
                    canPresidentPromoteMember(member, currentMember.id) ? (
                      <RolePromotionSelect
                        member={member}
                        isUpdating={updatingMemberId === member.id}
                        onRoleChange={handleRoleChange}
                      />
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={member.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isSearching && totalPages > 0 && (
        <div className="flex flex-col gap-4 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <label htmlFor="page-size" className="font-medium text-gray-700">
              Rows per page
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(event) =>
                handlePageSizeChange(Number(event.target.value))
              }
              className="rounded-md border border-gray-300 px-2 py-1 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </p>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || isLoading}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || isLoading}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {isSearching && total > SEARCH_FETCH_PAGE_SIZE && (
        <p className="border-t border-gray-200 px-6 py-3 text-xs text-gray-500">
          Search covers the first {SEARCH_FETCH_PAGE_SIZE} members. Refine your
          query for more specific results.
        </p>
      )}
    </section>
  );
}
