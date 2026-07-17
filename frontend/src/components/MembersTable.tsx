/**
 * Members directory table — GitHub Issues / Linear / Stripe style.
 * Presentation only: uses MemberResponse + optional dues lookup.
 * Missing fields show "—"; never invents placeholder metrics.
 */

import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Eye,
  Mail,
  MoreHorizontal,
  Pencil,
  Users,
} from "lucide-react";
import { useEffect, useId, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Link } from "react-router-dom";

import { Avatar } from "../design-system/components/Avatar";
import { EmptyState } from "../design-system/components/data-display/EmptyState";
import { Skeleton } from "../design-system/components/Skeleton";
import { useAuth } from "../context/useAuth";
import { useMediaQuery } from "../hooks/useMediaQuery";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import type { DuesStatus, MemberDuesRecord } from "../lib/dues-api";
import { formatCurrency } from "../lib/format-currency";
import { memberMailtoHref } from "../lib/member-mailto";
import {
  formatOutstandingDuesCell,
  type MemberDuesLookup,
} from "../lib/members-directory";
import { fetchMembers } from "../lib/members-api";
import {
  buildPositionHolders,
  canViewMemberDirectory,
  formatPositionLabel,
  getRoleBadgeClassName,
  isMemberRole,
  type MemberRole,
} from "../lib/roles";
import { EditMemberDrawer } from "./EditMemberDrawer";
import { MembersBulkActionBar } from "./MembersBulkActionBar";
import { MemberQuickViewDrawer } from "./MemberQuickViewDrawer";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

const MISSING = "—";

type SortKey = "name" | "role" | "status" | "graduation_year";
type SortDirection = "asc" | "desc";

type MembersTableProps = {
  members?: MemberResponse[];
  isLoading?: boolean;
  error?: string | null;
  /** Real dues rows from the finance API; omitted cells show "—". */
  duesByMemberId?: MemberDuesLookup;
  /** True when filters exclude every member but the org is not empty. */
  isFilterEmpty?: boolean;
  onInvite?: () => void;
  /** Keep parent directory state in sync after Edit Member saves. */
  onMemberUpdated?: (member: MemberResponse) => void;
};

type DuesTone = "paid" | "partial" | "overdue" | "missing";

type DuesCellView = {
  label: string;
  tone: DuesTone;
};

function duesCellFromRecord(
  record: MemberDuesRecord | undefined,
): DuesCellView {
  if (!record) {
    return { label: MISSING, tone: "missing" };
  }

  const status = record.status as DuesStatus;
  if (status === "paid" || status === "exempt") {
    return { label: "Paid", tone: "paid" };
  }

  const outstanding = formatOutstandingDuesCell(record);
  const label =
    outstanding !== null ? formatCurrency(outstanding) : formatCurrency(0);

  if (status === "partial") {
    return { label, tone: "partial" };
  }

  // unpaid (and any other unsettled status) uses overdue emphasis — no invented due dates
  return { label, tone: "overdue" };
}

function MembersDirectoryStatusPill({ status }: { status: string }) {
  const normalized = status.trim().toLowerCase();
  const map: Record<
    string,
    { label: string; tone: "active" | "pending" | "alumni" | "inactive" }
  > = {
    approved: { label: "Active", tone: "active" },
    pending: { label: "Pending", tone: "pending" },
    alumni: { label: "Alumni", tone: "alumni" },
    inactive: { label: "Inactive", tone: "inactive" },
    rejected: { label: "Inactive", tone: "inactive" },
  };

  const resolved = map[normalized] ?? {
    label: status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : MISSING,
    tone: "alumni" as const,
  };

  return (
    <span
      className={`members-table-status-pill members-table-status-pill--${resolved.tone}`}
    >
      <span className="members-table-status-dot" aria-hidden="true" />
      {resolved.label}
    </span>
  );
}

function MembersRoleBadge({
  role,
  position,
}: {
  role: string;
  position: MemberResponse["position"];
}) {
  if (!role) {
    return <span className="members-table-cell-muted">{MISSING}</span>;
  }

  const memberRole: MemberRole = isMemberRole(role) ? role : "general";
  const label =
    role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  const title =
    position !== "member"
      ? `${label} · ${formatPositionLabel(position)}`
      : label;

  return (
    <span className={getRoleBadgeClassName(memberRole, "sm")} title={title}>
      {label}
    </span>
  );
}

function MembersDuesCell({ view }: { view: DuesCellView }) {
  return (
    <span
      className={`members-table-dues members-table-dues--${view.tone} tabular-nums`}
    >
      {view.label}
    </span>
  );
}

function MembersRowActions({
  member,
  alwaysVisible = false,
  canEdit,
  onEdit,
}: {
  member: MemberResponse;
  alwaysVisible?: boolean;
  canEdit: boolean;
  onEdit: (member: MemberResponse) => void;
}) {
  const mailtoHref = memberMailtoHref(member.email);

  return (
    <div
      className={
        alwaysVisible
          ? "members-table-row-actions is-visible"
          : "members-table-row-actions"
      }
      onClick={(event) => event.stopPropagation()}
    >
      <Link
        to={`/members/${member.id}`}
        className="members-table-icon-action"
        aria-label={`View ${member.full_name}`}
        title="View"
        onClick={(event) => event.stopPropagation()}
      >
        <AppIcon icon={Eye} size="sm" className="text-current" />
      </Link>
      {canEdit ? (
        <button
          type="button"
          className="members-table-icon-action"
          title="Edit Member"
          aria-label={`Edit ${member.full_name}`}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(member);
          }}
        >
          <AppIcon icon={Pencil} size="sm" className="text-current" />
        </button>
      ) : null}
      {mailtoHref ? (
        <a
          href={mailtoHref}
          className="members-table-icon-action"
          title="Send Message"
          aria-label={`Send Message to ${member.full_name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <AppIcon icon={Mail} size="sm" className="text-current" />
        </a>
      ) : (
        <button
          type="button"
          className="members-table-icon-action"
          disabled
          title="No email on file"
          aria-label={`Send Message to ${member.full_name} (No email on file)`}
        >
          <AppIcon icon={Mail} size="sm" className="text-current" />
        </button>
      )}
      <button
        type="button"
        className="members-table-icon-action"
        disabled
        title="Coming soon"
        aria-label={`More actions for ${member.full_name} (coming soon)`}
      >
        <AppIcon icon={MoreHorizontal} size="sm" className="text-current" />
      </button>
    </div>
  );
}

function MembersEmptyIllustration() {
  return (
    <div className="members-table-empty-art" aria-hidden="true">
      <span className="members-table-empty-art-ring" />
      <span className="members-table-empty-art-ring members-table-empty-art-ring--mid" />
      <span className="members-table-empty-art-card">
        <span className="members-table-empty-art-avatar" />
        <span className="members-table-empty-art-lines">
          <span />
          <span />
        </span>
      </span>
      <span className="members-table-empty-art-card members-table-empty-art-card--back">
        <span className="members-table-empty-art-avatar" />
        <span className="members-table-empty-art-lines">
          <span />
          <span />
        </span>
      </span>
    </div>
  );
}

function MembersTableEmptyState({
  isFilterEmpty,
  onInvite,
}: {
  isFilterEmpty?: boolean;
  onInvite?: () => void;
}) {
  if (isFilterEmpty) {
    return (
      <div className="members-table-shell members-table-empty">
        <EmptyState
          icon={<AppIcon icon={Users} size="md" className="text-current" />}
          title="No matching members"
          description="Try adjusting search or filters to see more people."
        />
      </div>
    );
  }

  return (
    <div className="members-table-shell members-table-empty">
      <div className="members-table-empty-state">
        <MembersEmptyIllustration />
        <p className="members-table-empty-title">No members yet.</p>
        <p className="members-table-empty-subtitle">
          Invite members or import a roster to get started.
        </p>
        <div className="members-table-empty-actions">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onInvite}
            disabled={!onInvite}
          >
            Invite Member
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Coming soon"
          >
            Import CSV
          </Button>
        </div>
      </div>
    </div>
  );
}

function MembersTableSkeleton({
  rows = 7,
  isMobile,
}: {
  rows?: number;
  isMobile: boolean;
}) {
  if (isMobile) {
    return (
      <div className="members-table-shell members-table-shell--skeleton" aria-hidden="true">
        <div className="members-table-mobile-list">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="members-table-card">
              <div className="members-table-card-top">
                <Skeleton height={16} width={16} variant="rectangular" />
                <Skeleton height={40} width={40} variant="circular" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton height={14} width="55%" />
                  <Skeleton height={12} width="35%" />
                </div>
              </div>
              <div className="members-table-card-meta mt-3">
                <Skeleton height={12} width="40%" />
                <Skeleton height={12} width="40%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="members-table-shell members-table-shell--skeleton" aria-hidden="true">
      <div className="members-table-scroll">
        <table className="members-table">
          <thead>
            <tr>
              {Array.from({ length: 9 }).map((_, index) => (
                <th key={index}>
                  <Skeleton height={12} width={index === 0 ? 16 : 56} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="members-table-row members-table-row--skeleton">
                <td className="members-table-check-col">
                  <Skeleton height={16} width={16} variant="rectangular" />
                </td>
                <td className="members-table-avatar-col">
                  <Skeleton height={40} width={40} variant="circular" />
                </td>
                <td>
                  <div className="space-y-2">
                    <Skeleton height={14} width="58%" />
                    <Skeleton height={12} width="42%" />
                  </div>
                </td>
                <td>
                  <Skeleton height={22} width={64} />
                </td>
                <td>
                  <Skeleton height={22} width={72} />
                </td>
                <td className="members-table-col-grad">
                  <Skeleton height={14} width={40} />
                </td>
                <td className="members-table-col-dues">
                  <Skeleton height={14} width={52} />
                </td>
                <td className="members-table-col-attendance">
                  <Skeleton height={14} width={28} />
                </td>
                <td className="members-table-actions-col">
                  <Skeleton height={28} width={96} />
                </td>
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
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  const ariaSort = active
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
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
          className={active ? "text-foreground" : "text-label/70"}
        />
      </button>
    </th>
  );
}

export function MembersTable({
  members: controlledMembers,
  isLoading: controlledLoading,
  error: controlledError,
  duesByMemberId,
  isFilterEmpty = false,
  onInvite,
  onMemberUpdated,
}: MembersTableProps) {
  const { member: currentMember } = useAuth();
  const selectAllId = useId();
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const [internalMembers, setInternalMembers] = useState<MemberResponse[]>([]);
  const [internalLoading, setInternalLoading] = useState(
    controlledMembers === undefined,
  );
  const [internalError, setInternalError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [selectionAnchorIndex, setSelectionAnchorIndex] = useState<
    number | null
  >(null);
  const [quickViewMember, setQuickViewMember] = useState<MemberResponse | null>(
    null,
  );
  const [editMember, setEditMember] = useState<MemberResponse | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const canEditMembers = Boolean(
    currentMember && canViewMemberDirectory(currentMember.role),
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

  const displayedMembers = useMemo(() => {
    if (!sortKey) {
      return members;
    }
    const sorted = [...members];
    sorted.sort((left, right) => {
      if (sortKey === "graduation_year") {
        const cmp = left.graduation_year - right.graduation_year;
        return sortDirection === "asc" ? cmp : -cmp;
      }
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

  function selectAllVisible() {
    setSelectedIds(new Set(displayedMembers.map((member) => member.id)));
    setSelectionAnchorIndex(displayedMembers.length > 0 ? 0 : null);
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectionAnchorIndex(null);
  }

  function toggleAll() {
    if (allVisibleSelected) {
      clearSelection();
      return;
    }
    selectAllVisible();
  }

  /**
   * Gmail-style selection: plain click toggles one row;
   * Shift+click selects the inclusive range from the last anchor.
   */
  function handleSelectClick(
    event: MouseEvent<HTMLInputElement>,
    memberId: number,
    index: number,
  ) {
    event.stopPropagation();
    event.preventDefault();

    if (
      event.shiftKey &&
      selectionAnchorIndex !== null &&
      displayedMembers.length > 0
    ) {
      const start = Math.min(selectionAnchorIndex, index);
      const end = Math.max(selectionAnchorIndex, index);
      setSelectedIds((current) => {
        const next = new Set(current);
        for (let cursor = start; cursor <= end; cursor += 1) {
          const member = displayedMembers[cursor];
          if (member) {
            next.add(member.id);
          }
        }
        return next;
      });
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
    setSelectionAnchorIndex(index);
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

  function openEditMember(member: MemberResponse) {
    setEditMember(member);
  }

  function closeEditMember() {
    setEditMember(null);
  }

  function handleMemberUpdated(updated: MemberResponse) {
    if (!isControlled) {
      setInternalMembers((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
    }
    setQuickViewMember((current) =>
      current?.id === updated.id ? updated : current,
    );
    setEditMember((current) =>
      current?.id === updated.id ? updated : current,
    );
    onMemberUpdated?.(updated);
  }

  const positionHolders = useMemo(
    () => buildPositionHolders(members),
    [members],
  );

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
      <MembersTableEmptyState
        isFilterEmpty={isFilterEmpty}
        onInvite={onInvite}
      />
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
        <MembersBulkActionBar
          selectedCount={selectedCount}
          allVisibleSelected={allVisibleSelected}
          onClear={clearSelection}
          onSelectAll={selectAllVisible}
        />

        {isMobile ? (
          <ul className="members-table-mobile-list">
            {displayedMembers.map((member, index) => {
              const selected = selectedIds.has(member.id);
              const dues = duesCellFromRecord(duesByMemberId?.get(member.id));
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
                        onChange={() => undefined}
                        onClick={(event) =>
                          handleSelectClick(event, member.id, index)
                        }
                        aria-label={`Select ${member.full_name}`}
                      />
                      <Avatar
                        name={member.full_name}
                        size="md"
                        className="members-table-avatar"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="members-table-card-heading">
                          <div className="min-w-0">
                            <p className="members-table-name">
                              {member.full_name}
                            </p>
                            <p className="members-table-meta">
                              {member.email?.trim() || member.major}
                            </p>
                          </div>
                          <MembersDirectoryStatusPill status={member.status} />
                        </div>
                      </div>
                    </div>

                    <dl className="members-table-card-meta">
                      <div>
                        <dt>Role</dt>
                        <dd>
                          <MembersRoleBadge
                            role={member.role}
                            position={member.position}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>Graduation</dt>
                        <dd>{member.graduation_year || MISSING}</dd>
                      </div>
                      <div>
                        <dt>Dues</dt>
                        <dd>
                          <MembersDuesCell view={dues} />
                        </dd>
                      </div>
                      <div>
                        <dt>Attendance</dt>
                        <dd>
                          <span className="members-table-cell-muted">
                            {MISSING}
                          </span>
                        </dd>
                      </div>
                    </dl>

                    <div className="members-table-card-actions">
                      <MembersRowActions
                        member={member}
                        alwaysVisible
                        canEdit={canEditMembers}
                        onEdit={openEditMember}
                      />
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
                  <SortHeader
                    label="Status"
                    sortKey="status"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Graduation Year"
                    sortKey="graduation_year"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="members-table-col-grad"
                  />
                  <th scope="col" className="members-table-col-dues">
                    Outstanding Dues
                  </th>
                  <th scope="col" className="members-table-col-attendance">
                    Attendance
                  </th>
                  <th scope="col" className="members-table-actions-col">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedMembers.map((member, index) => {
                  const selected = selectedIds.has(member.id);
                  const dues = duesCellFromRecord(
                    duesByMemberId?.get(member.id),
                  );
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
                          onChange={() => undefined}
                          onClick={(event) =>
                            handleSelectClick(event, member.id, index)
                          }
                          aria-label={`Select ${member.full_name}`}
                        />
                      </td>
                      <td className="members-table-avatar-col">
                        <Avatar
                          name={member.full_name}
                          size="md"
                          className="members-table-avatar"
                        />
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
                        <MembersRoleBadge
                          role={member.role}
                          position={member.position}
                        />
                      </td>
                      <td>
                        <MembersDirectoryStatusPill status={member.status} />
                      </td>
                      <td className="members-table-col-grad">
                        <span className="members-table-cell-text tabular-nums">
                          {member.graduation_year || MISSING}
                        </span>
                      </td>
                      <td className="members-table-col-dues">
                        <MembersDuesCell view={dues} />
                      </td>
                      <td className="members-table-col-attendance">
                        <span className="members-table-cell-muted">
                          {MISSING}
                        </span>
                      </td>
                      <td className="members-table-actions-col">
                        <MembersRowActions
                          member={member}
                          canEdit={canEditMembers}
                          onEdit={openEditMember}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MemberQuickViewDrawer
        member={quickViewMember}
        open={quickViewMember !== null}
        onClose={closeQuickView}
        duesRecord={
          quickViewMember
            ? (duesByMemberId?.get(quickViewMember.id) ?? null)
            : null
        }
        onEditMember={canEditMembers ? openEditMember : undefined}
      />

      <EditMemberDrawer
        member={editMember}
        open={editMember !== null}
        onClose={closeEditMember}
        onMemberUpdated={handleMemberUpdated}
        positionHolders={positionHolders}
      />
    </>
  );
}
