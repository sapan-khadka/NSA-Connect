/**
 * Members directory table — presentation layer.
 * Uses existing MemberResponse fields as-is; missing domain fields show "—".
 */

import { MoreHorizontal, Users } from "lucide-react";
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
import { MemberQuickViewDrawer } from "./MemberQuickViewDrawer";
import { StatusBadge } from "./StatusBadge";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

const MISSING = "—";

function formatRoleLabel(role: string): string {
  if (!role) {
    return MISSING;
  }
  return role.charAt(0).toUpperCase() + role.slice(1);
}

type MembersTableProps = {
  /** Optional controlled rows — when omitted, the table loads via existing fetchMembers. */
  members?: MemberResponse[];
  isLoading?: boolean;
  error?: string | null;
};

function MembersTableSkeleton({
  rows = 6,
  isDesktop,
}: {
  rows?: number;
  isDesktop: boolean;
}) {
  if (!isDesktop) {
    return (
      <div className="members-table-shell" aria-hidden="true">
        <div className="space-y-3 p-3">
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
              {Array.from({ length: 10 }).map((_, index) => (
                <th key={index}>
                  <Skeleton height={12} width={index === 0 ? 16 : 64} />
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
                  <Skeleton height={32} width={32} variant="circular" />
                </td>
                <td>
                  <div className="space-y-2">
                    <Skeleton height={14} width="70%" />
                    <Skeleton height={12} width="45%" />
                  </div>
                </td>
                {Array.from({ length: 7 }).map((__, cellIndex) => (
                  <td key={cellIndex}>
                    <Skeleton height={14} width="60%" />
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
        className="!min-h-8 !px-2"
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
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [internalMembers, setInternalMembers] = useState<MemberResponse[]>([]);
  const [internalLoading, setInternalLoading] = useState(
    controlledMembers === undefined,
  );
  const [internalError, setInternalError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [quickViewMember, setQuickViewMember] = useState<MemberResponse | null>(
    null,
  );

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

  const allVisibleSelected =
    members.length > 0 && members.every((member) => selectedIds.has(member.id));
  const someSelected = members.some((member) => selectedIds.has(member.id));

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  function toggleAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(members.map((member) => member.id)));
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
        <MembersTableSkeleton isDesktop={isDesktop} />
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
      <div className="members-table-shell">
        {isDesktop ? (
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
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Committee</th>
                  <th scope="col">Attendance</th>
                  <th scope="col">Dues</th>
                  <th scope="col">Last Activity</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
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
                      <td>
                        <StatusBadge status={member.status} />
                      </td>
                      <td
                        className="text-right"
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
        ) : (
          <ul className="members-table-mobile-list">
            {members.map((member) => {
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
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="members-table-checkbox mt-1"
                        checked={selected}
                        onChange={() => toggleRow(member.id)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${member.full_name}`}
                      />
                      <Avatar name={member.full_name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
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

                        <p className="members-table-card-hint">
                          Open for full profile details.
                        </p>

                        <div
                          className="mt-3 flex justify-end"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MemberActions member={member} />
                        </div>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
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

