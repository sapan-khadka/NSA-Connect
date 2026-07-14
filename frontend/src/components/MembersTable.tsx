/**
 * Members directory table — Linear / GitHub Issues style.
 * Uses existing MemberResponse fields; missing domain fields show "—".
 * Client-side sort indicators only — does not change API data.
 */

import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";

import { Avatar } from "../design-system/components/Avatar";
import { EmptyState } from "../design-system/components/data-display/EmptyState";
import { Skeleton } from "../design-system/components/Skeleton";
import { useMediaQuery } from "../hooks/useMediaQuery";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchMembers } from "../lib/members-api";
import { formatPositionLabel } from "../lib/roles";
import { MembersBulkActionBar } from "./MembersBulkActionBar";
import { MemberHealthBadge } from "./MemberHealthBadge";
import { MemberQuickViewDrawer } from "./MemberQuickViewDrawer";
import { StatusBadge } from "./StatusBadge";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

const MISSING = "—";

type SortKey = "name" | "role" | "status";
type SortDirection = "asc" | "desc";

type MembersTableProps = {
  members?: MemberResponse[];
  isLoading?: boolean;
  error?: string | null;
};

function formatRoleLabel(role: string): string {
  if (!role) {
    return MISSING;
  }
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function MembersTableSkeleton({
  rows = 6,
  isMobile,
}: {
  rows?: number;
  isMobile: boolean;
}) {
  if (isMobile) {
    return (
      <div className="members-table-shell" aria-hidden="true">
        <div className="members-table-mobile-list">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="members-table-card">
              <div className="flex items-center gap-3">
                <Skeleton height={16} width={16} variant="rectangular" />
                <Skeleton height={40} width={40} variant="circular" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton height={14} width="55%" />
                  <Skeleton height={12} width="35%" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="members-table-shell" aria-hidden="true">
      <div className="members-table-scroll">
        <table className="members-table">
          <thead>
            <tr>
              {Array.from({ length: 11 }).map((_, index) => (
                <th key={index}>
                  <Skeleton height={12} width={index === 0 ? 16 : 56} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                <td>
                  <Skeleton height={16} width={16} variant="rectangular" />
                </td>
                <td>
                  <Skeleton height={28} width={28} variant="circular" />
                </td>
                <td>
                  <div className="space-y-2">
                    <Skeleton height={14} width="70%" />
                    <Skeleton height={12} width="45%" />
                  </div>
                </td>
                {Array.from({ length: 8 }).map((__, cellIndex) => (
                  <td key={cellIndex}>
                    <Skeleton height={14} width="55%" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  const ariaSort = active
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th scope="col" aria-sort={ariaSort}>
      <button
        type="button"
        className="members-table-sort"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}${
          active ? `, currently ${ariaSort}` : ""
        }`}
      >
        <span>{label}</span>
        <AppIcon
          icon={
            active ? (direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown
          }
          size="xs"
          className={
            active ? "text-foreground" : "text-label/70"
          }
        />
      </button>
    </th>
  );
}

function MemberActions({ member }: { member: MemberResponse }) {
  return (
    <div className="members-table-actions">
      <Link
        to={`/members/${member.id}`}
        className="members-table-action-link"
        onClick={(event) => event.stopPropagation()}
      >
        View
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="members-table-more-btn"
        disabled
        title="Coming soon"
        aria-label={`More actions for ${member.full_name} (coming soon)`}
        onClick={(event) => event.stopPropagation()}
      >
        <AppIcon icon={MoreHorizontal} size="sm" className="text-label" />
      </Button>
    </div>
  );
}

export function MembersTable({
  members: controlledMembers,
  isLoading: controlledLoading,
  error: controlledError,
}: MembersTableProps) {
  const selectAllId = useId();
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const [internalMembers, setInternalMembers] = useState<MemberResponse[]>([]);
  const [internalLoading, setInternalLoading] = useState(
    controlledMembers === undefined,
  );
  const [internalError, setInternalError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [quickViewMember, setQuickViewMember] = useState<MemberResponse | null>(
    null,
  );
  const [sortKey, setSortKey] = useState<SortKey | null>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const isControlled = controlledMembers !== undefined;
  const members = isControlled ? controlledMembers : internalMembers;
  const isLoading = isControlled
    ? Boolean(controlledLoading)
    : internalLoading;
  const error = isControlled ? (controlledError ?? null) : internalError;

  useEffect(() => {
    if (isControlled) {
      return;
    }

    let cancelled = false;
    setInternalLoading(true);
    setInternalError(null);

    void fetchMembers({ page: 1, page_size: 48 })
      .then((response) => {
        if (!cancelled) {
          setInternalMembers(response.members);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setInternalError(getApiErrorMessage(fetchError));
          setInternalMembers([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInternalLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isControlled]);

  const displayedMembers = useMemo(() => {
    if (!sortKey) {
      return members;
    }
    const sorted = [...members];
    sorted.sort((left, right) => {
      const leftValue =
        sortKey === "name"
          ? left.full_name
          : sortKey === "role"
            ? left.role
            : left.status;
      const rightValue =
        sortKey === "name"
          ? right.full_name
          : sortKey === "role"
            ? right.role
            : right.status;
      const cmp = leftValue.localeCompare(rightValue, undefined, {
        sensitivity: "base",
      });
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [members, sortKey, sortDirection]);

  const allVisibleSelected =
    displayedMembers.length > 0 &&
    displayedMembers.every((member) => selectedIds.has(member.id));
  const someSelected = displayedMembers.some((member) =>
    selectedIds.has(member.id),
  );
  const selectedCount = selectedIds.size;

  function toggleAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(displayedMembers.map((member) => member.id)));
  }

  function toggleRow(memberId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function openQuickView(member: MemberResponse) {
    setQuickViewMember(member);
  }

  function closeQuickView() {
    setQuickViewMember(null);
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLElement>,
    member: MemberResponse,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openQuickView(member);
  }

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite">
        <p className="sr-only">Loading members…</p>
        <MembersTableSkeleton isMobile={isMobile} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="members-table-shell p-8" role="alert">
        <EmptyState title="Couldn't load members" description={error} />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="members-table-shell">
        <EmptyState
          icon={<AppIcon icon={Users} size="md" className="text-current" />}
          title="No members yet"
          description="When members join your organization, they’ll appear here."
        />
      </div>
    );
  }

  return (
    <>
      <div
        className={
          selectedCount > 0
            ? "members-table-shell is-bulk-active"
            : "members-table-shell"
        }
      >
        {isMobile ? (
          <ul className="members-table-mobile-list">
            {displayedMembers.map((member) => {
              const selected = selectedIds.has(member.id);
              return (
                <li key={member.id}>
                  <article
                    className="members-table-card"
                    data-selected={selected ? "true" : undefined}
                    tabIndex={0}
                    aria-label={`Quick view ${member.full_name}`}
                    onClick={() => openQuickView(member)}
                    onKeyDown={(event) => handleRowKeyDown(event, member)}
                  >
                    <div className="members-table-card-top">
                      <input
                        type="checkbox"
                        className="members-table-checkbox"
                        checked={selected}
                        onChange={() => toggleRow(member.id)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${member.full_name}`}
                      />
                      <Avatar name={member.full_name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="members-table-card-heading">
                          <div className="min-w-0">
                            <p className="members-table-name">
                              {member.full_name}
                            </p>
                            <p className="members-table-meta">
                              {formatRoleLabel(member.role)}
                              {member.position !== "member"
                                ? ` · ${formatPositionLabel(member.position)}`
                                : ""}
                            </p>
                          </div>
                          <StatusBadge status={member.status} />
                        </div>
                      </div>
                    </div>

                    <dl className="members-table-card-meta">
                      <div>
                        <dt>Attendance</dt>
                        <dd>{MISSING}</dd>
                      </div>
                      <div>
                        <dt>Health</dt>
                        <dd>
                          <MemberHealthBadge
                            memberId={member.id}
                            role={member.role}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>Dues</dt>
                        <dd>{MISSING}</dd>
                      </div>
                      <div>
                        <dt>Activity</dt>
                        <dd>{MISSING}</dd>
                      </div>
                    </dl>

                    <div
                      className="members-table-card-actions"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MemberActions member={member} />
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="members-table-scroll">
            <table className="members-table">
              <caption className="sr-only">Organization members</caption>
              <thead>
                <tr>
                  <th scope="col" className="members-table-check-col">
                    <input
                      id={selectAllId}
                      type="checkbox"
                      className="members-table-checkbox"
                      checked={allVisibleSelected}
                      ref={(element) => {
                        if (element) {
                          element.indeterminate =
                            someSelected && !allVisibleSelected;
                        }
                      }}
                      onChange={toggleAll}
                      aria-label="Select all members"
                    />
                  </th>
                  <th scope="col" className="members-table-avatar-col">
                    <span className="sr-only">Avatar</span>
                  </th>
                  <SortHeader
                    label="Name"
                    sortKey="name"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Role"
                    sortKey="role"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <th scope="col">Committee</th>
                  <th scope="col">Attendance</th>
                  <th scope="col" className="members-table-col-health">
                    Member Health
                  </th>
                  <th scope="col">Outstanding Dues</th>
                  <th scope="col" className="members-table-col-activity">
                    Last Activity
                  </th>
                  <SortHeader
                    label="Status"
                    sortKey="status"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <th scope="col" className="members-table-actions-col">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedMembers.map((member) => {
                  const selected = selectedIds.has(member.id);
                  return (
                    <tr
                      key={member.id}
                      data-selected={selected ? "true" : undefined}
                      tabIndex={0}
                      aria-label={`Quick view ${member.full_name}`}
                      onClick={() => openQuickView(member)}
                      onKeyDown={(event) => handleRowKeyDown(event, member)}
                      className="members-table-row"
                    >
                      <td className="members-table-check-col">
                        <input
                          type="checkbox"
                          className="members-table-checkbox"
                          checked={selected}
                          onChange={() => toggleRow(member.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${member.full_name}`}
                        />
                      </td>
                      <td className="members-table-avatar-col">
                        <Avatar name={member.full_name} size="sm" />
                      </td>
                      <td>
                        <div className="min-w-0">
                          <p className="members-table-name">
                            {member.full_name}
                          </p>
                          <p className="members-table-meta">
                            {member.email?.trim() || member.major}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className="members-table-cell-text">
                          {formatRoleLabel(member.role)}
                        </span>
                      </td>
                      <td>
                        <span className="members-table-cell-muted">
                          {MISSING}
                        </span>
                      </td>
                      <td>
                        <span className="members-table-cell-muted">
                          {MISSING}
                        </span>
                      </td>
                      <td className="members-table-col-health">
                        <MemberHealthBadge
                          memberId={member.id}
                          role={member.role}
                          showScore
                        />
                      </td>
                      <td>
                        <span className="members-table-cell-muted">
                          {MISSING}
                        </span>
                      </td>
                      <td className="members-table-col-activity">
                        <span className="members-table-cell-muted">
                          {MISSING}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={member.status} />
                      </td>
                      <td
                        className="members-table-actions-col"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MemberActions member={member} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MembersBulkActionBar
        selectedCount={selectedCount}
        onClear={() => setSelectedIds(new Set())}
      />

      <MemberQuickViewDrawer
        member={quickViewMember}
        open={quickViewMember !== null}
        onClose={closeQuickView}
      />
    </>
  );
}
