/**
 * Members directory table — GitHub Issues / Linear / Stripe style.
 * Presentation only: uses MemberResponse + optional dues lookup.
 * Missing fields show "—"; never invents placeholder metrics.
 */

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUpDown,
  Eye,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Settings,
  Users,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import { Avatar } from "../design-system/components/Avatar";
import { EmptyState } from "../design-system/components/data-display/EmptyState";
import { Skeleton } from "../design-system/components/Skeleton";
import { useAuth } from "../context/useAuth";
import { useMediaQuery } from "../hooks/useMediaQuery";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import type { DuesStatus, MemberDuesRecord } from "../lib/dues-api";
import { formatCurrencyCompact } from "../lib/format-currency";
import { memberMailtoHref } from "../lib/member-mailto";
import { openDirectMessage } from "../lib/open-direct-message";
import {
  compareMembersByDirectoryOrder,
  formatOutstandingDuesCell,
  getDirectorySectionLabel,
  getMemberDirectorySubtitle,
  getMemberDirectorySection,
  sortMembersByDirectoryOrder,
  type MemberDuesLookup,
  type MemberEngagementLookup,
  type MembersDirectorySection,
} from "../lib/members-directory";
import { fetchMembers } from "../lib/members-api";
import {
  buildPositionHolders,
  canViewMemberDirectory,
} from "../lib/roles";
import { EditMemberDrawer } from "./EditMemberDrawer";
import { MembersBulkActionBar } from "./MembersBulkActionBar";
import { MemberQuickViewDrawer } from "./MemberQuickViewDrawer";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

const MISSING = "—";

type SortKey = "name";
type SortDirection = "asc" | "desc";

type MembersTableProps = {
  members?: MemberResponse[];
  /** Unfiltered directory used for exclusive-position occupancy labels. */
  positionSourceMembers?: MemberResponse[];
  isLoading?: boolean;
  error?: string | null;
  /** Real dues rows from the finance API; omitted cells show "—". */
  duesByMemberId?: MemberDuesLookup;
  /** Activity-based active/idle for approved members. */
  engagementByMemberId?: MemberEngagementLookup;
  /** True when filters exclude every member but the org is not empty. */
  isFilterEmpty?: boolean;
  /** Shows row checkboxes + floating bulk action bar when true. */
  enableBulkSelection?: boolean;
  /**
   * Keep the dense CRM table (horizontal scroll) instead of mobile cards.
   * Members directory always prefers this.
   */
  forceTableView?: boolean;
  onInvite?: () => void;
  /** Keep parent directory state in sync after Edit Member saves. */
  onMemberUpdated?: (
    member: MemberResponse,
    previousHolder?: MemberResponse | null,
  ) => void;
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
    outstanding !== null
      ? formatCurrencyCompact(outstanding)
      : formatCurrencyCompact(0);

  if (status === "partial") {
    return { label, tone: "partial" };
  }

  // unpaid (and any other unsettled status) uses overdue emphasis — no invented due dates
  return { label, tone: "overdue" };
}

function MembersDirectoryStatusPill({
  status,
  engagement,
}: {
  status: string;
  engagement?: "active" | "idle" | null;
}) {
  const normalized = status.trim().toLowerCase();

  if (normalized === "approved") {
    const engaged = engagement === "active";
    const idle = engagement === "idle";
    const tone = engaged ? "active" : idle ? "inactive" : "alumni";
    const label = engaged ? "Active" : idle ? "Idle" : "Approved";
    return (
      <span
        className={`members-table-status-pill members-table-status-pill--${tone}`}
        title={
          engaged
            ? "Recent attendance, dues, tasks, or suggestions"
            : idle
              ? "No recent engagement signals"
              : "Membership approved"
        }
      >
        <span className="members-table-status-dot" aria-hidden="true" />
        {label}
      </span>
    );
  }

  const map: Record<
    string,
    { label: string; tone: "active" | "pending" | "alumni" | "inactive" }
  > = {
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

function MembersDuesCell({ view }: { view: DuesCellView }) {
  if (view.tone === "missing") {
    return (
      <span className="members-table-dues members-table-dues--missing">
        {MISSING}
      </span>
    );
  }

  if (view.tone === "paid") {
    return (
      <span
        className="members-table-dues members-table-dues--paid"
        title="Paid"
        aria-label="Paid"
      >
        <AppIcon icon={Check} size="xs" className="members-table-dues-check" />
      </span>
    );
  }

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
  isSelf = false,
}: {
  member: MemberResponse;
  alwaysVisible?: boolean;
  canEdit: boolean;
  onEdit: (member: MemberResponse) => void;
  isSelf?: boolean;
}) {
  const navigate = useNavigate();
  const mailtoHref = memberMailtoHref(member.email);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!moreOpen) {
      return;
    }

    function handlePointerDown(event: globalThis.MouseEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setMoreOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  async function handleMessage() {
    if (isSelf || messageLoading) {
      return;
    }
    setMessageLoading(true);
    try {
      await openDirectMessage(navigate, member.id);
    } catch (error) {
      window.alert(getApiErrorMessage(error));
    } finally {
      setMessageLoading(false);
    }
  }

  const menu = moreOpen ? (
    <div id={menuId} role="menu" className="members-table-more-menu">
      <Link
        to={`/members/${member.id}`}
        role="menuitem"
        className="members-table-more-item"
        onClick={(event) => event.stopPropagation()}
      >
        <AppIcon icon={Eye} size="xs" className="text-current" />
        View
      </Link>
      <button
        type="button"
        role="menuitem"
        className="members-table-more-item"
        disabled={isSelf || messageLoading}
        onClick={(event) => {
          event.stopPropagation();
          setMoreOpen(false);
          void handleMessage();
        }}
      >
        <AppIcon icon={MessageSquare} size="xs" className="text-current" />
        Message
      </button>
      {canEdit ? (
        <button
          type="button"
          role="menuitem"
          className="members-table-more-item"
          onClick={(event) => {
            event.stopPropagation();
            setMoreOpen(false);
            onEdit(member);
          }}
        >
          <AppIcon icon={Pencil} size="xs" className="text-current" />
          Edit
        </button>
      ) : null}
      {mailtoHref ? (
        <a
          href={mailtoHref}
          role="menuitem"
          className="members-table-more-item"
          onClick={(event) => event.stopPropagation()}
        >
          <AppIcon icon={Mail} size="xs" className="text-current" />
          Email
        </a>
      ) : null}
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={
        alwaysVisible
          ? "members-table-row-actions is-visible"
          : "members-table-row-actions"
      }
      onClick={(event) => event.stopPropagation()}
    >
      {alwaysVisible ? (
        <>
          <Link
            to={`/members/${member.id}`}
            className="members-table-icon-action"
            aria-label={`View ${member.full_name}`}
            title="View"
            onClick={(event) => event.stopPropagation()}
          >
            <AppIcon icon={Eye} size="sm" className="text-current" />
          </Link>
          <button
            type="button"
            className="members-table-icon-action"
            title="Message"
            aria-label={`Message ${member.full_name}`}
            disabled={isSelf || messageLoading}
            onClick={(event) => {
              event.stopPropagation();
              void handleMessage();
            }}
          >
            <AppIcon icon={MessageSquare} size="sm" className="text-current" />
          </button>
        </>
      ) : null}
      <button
        type="button"
        className="members-table-icon-action"
        title="More"
        aria-label={`More actions for ${member.full_name}`}
        aria-expanded={moreOpen}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={(event) => {
          event.stopPropagation();
          setMoreOpen((open) => !open);
        }}
      >
        <AppIcon icon={MoreHorizontal} size="sm" className="text-current" />
      </button>
      {menu}
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
          Add members or import a roster to get started.
        </p>
        <div className="members-table-empty-actions">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onInvite}
            disabled={!onInvite}
          >
            Add Member
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
  positionSourceMembers,
  isLoading: controlledLoading,
  error: controlledError,
  duesByMemberId,
  engagementByMemberId,
  isFilterEmpty = false,
  enableBulkSelection = false,
  forceTableView = false,
  onInvite,
  onMemberUpdated,
}: MembersTableProps) {
  const { member: currentMember } = useAuth();
  const selectAllId = useId();
  const isNarrow = !useMediaQuery("(min-width: 1024px)");
  const isMobile = forceTableView ? false : isNarrow;
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
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
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
    const ordered = sortMembersByDirectoryOrder(members, engagementByMemberId);
    if (!sortKey) {
      return ordered;
    }
    // Leadership priority stays primary; Name / Class Year are tertiary only.
    return [...ordered].sort((left, right) => {
      const hierarchy = compareMembersByDirectoryOrder(
        left,
        right,
        engagementByMemberId,
      );
      if (hierarchy !== 0) {
        return hierarchy;
      }
      const cmp = left.full_name.localeCompare(right.full_name, undefined, {
        sensitivity: "base",
      });
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [members, engagementByMemberId, sortKey, sortDirection]);

  const sectionCounts = useMemo(() => {
    const counts: Record<MembersDirectorySection, number> = {
      leadership: 0,
      board: 0,
      general: 0,
    };
    for (const member of displayedMembers) {
      counts[getMemberDirectorySection(member)] += 1;
    }
    return counts;
  }, [displayedMembers]);
  const showDirectorySections =
    [sectionCounts.leadership, sectionCounts.board, sectionCounts.general].filter(
      (count) => count > 0,
    ).length > 1;
  const tableColumnCount = enableBulkSelection ? 6 : 5;

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
    () => buildPositionHolders(positionSourceMembers ?? members),
    [positionSourceMembers, members],
  );

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
          enableBulkSelection && selectedCount > 0
            ? "members-table-shell is-bulk-active"
            : "members-table-shell"
        }
      >
        {enableBulkSelection ? (
          <MembersBulkActionBar
            selectedCount={selectedCount}
            allVisibleSelected={allVisibleSelected}
            onClear={clearSelection}
            onSelectAll={selectAllVisible}
          />
        ) : null}

        {isMobile ? (
          <ul className="members-table-mobile-list">
            {displayedMembers.map((member, index) => {
              const selected = selectedIds.has(member.id);
              const dues = duesCellFromRecord(duesByMemberId?.get(member.id));
              return (
                <li key={member.id}>
                  <article
                    className="members-table-card"
                    data-selected={
                      enableBulkSelection && selected ? "true" : undefined
                    }
                  >
                    <div className="members-table-card-top">
                      {enableBulkSelection ? (
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
                      ) : null}
                      <button
                        type="button"
                        className="members-table-avatar-btn"
                        aria-label={`Preview ${member.full_name}`}
                        onClick={() => openQuickView(member)}
                      >
                        <Avatar
                          name={member.full_name}
                          src={member.avatar_url}
                          size="md"
                          className="members-table-avatar"
                        />
                      </button>
                      <div className="members-table-card-identity">
                        <p className="members-table-name">
                          {getMemberDirectorySection(member) ===
                          "leadership" ? (
                            <span
                              className="members-table-leadership-dot"
                              aria-hidden="true"
                            />
                          ) : null}
                          <Link
                            to={`/members/${member.id}`}
                            className="members-table-name-link"
                          >
                            {member.full_name}
                          </Link>
                        </p>
                        {(() => {
                          const subtitle = getMemberDirectorySubtitle(member);
                          return subtitle ? (
                            <p className="members-table-role-line">{subtitle}</p>
                          ) : null;
                        })()}
                        <MembersDirectoryStatusPill
                          status={member.status}
                          engagement={
                            engagementByMemberId?.get(member.id) ?? null
                          }
                        />
                      </div>
                    </div>

                    <div className="members-table-card-footer">
                      <div className="members-table-card-chips">
                        {dues.tone !== "missing" ? (
                          <MembersDuesCell view={dues} />
                        ) : null}
                      </div>
                      <div className="members-table-card-actions">
                        <MembersRowActions
                          member={member}
                          alwaysVisible
                          canEdit={canEditMembers}
                          onEdit={openEditMember}
                          isSelf={currentMember?.id === member.id}
                        />
                      </div>
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
                  {enableBulkSelection ? (
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
                  ) : null}
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
                  <th scope="col">Status</th>
                  <th scope="col" className="members-table-col-dues">
                    Outstanding
                  </th>
                  <th scope="col" className="members-table-actions-col">
                    <span className="sr-only">Actions</span>
                    <button
                      type="button"
                      className="members-table-settings-btn"
                      aria-label="Column settings"
                      title="Column settings coming soon"
                      disabled
                    >
                      <AppIcon
                        icon={Settings}
                        size="xs"
                        className="text-current"
                      />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedMembers.map((member, index) => {
                  const selected = selectedIds.has(member.id);
                  const dues = duesCellFromRecord(
                    duesByMemberId?.get(member.id),
                  );
                  const section = getMemberDirectorySection(member);
                  const previousSection =
                    index > 0
                      ? getMemberDirectorySection(displayedMembers[index - 1])
                      : null;
                  const showSectionHeader =
                    showDirectorySections && section !== previousSection;
                  const isLeadership = section === "leadership";
                  const subtitle = getMemberDirectorySubtitle(member, section);
                  return (
                    <Fragment key={member.id}>
                      {showSectionHeader ? (
                        <tr className="members-table-section-row">
                          <th
                            scope="colgroup"
                            colSpan={tableColumnCount}
                            className="members-table-section-heading"
                          >
                            <span className="members-table-section-label">
                              {getDirectorySectionLabel(section)}
                            </span>
                            <span className="members-table-section-count">
                              {sectionCounts[section]}
                            </span>
                          </th>
                        </tr>
                      ) : null}
                      <tr
                        data-selected={
                          enableBulkSelection && selected ? "true" : undefined
                        }
                        className={
                          isLeadership
                            ? "members-table-row members-table-row--leadership"
                            : "members-table-row"
                        }
                      >
                        {enableBulkSelection ? (
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
                        ) : null}
                        <td className="members-table-avatar-col">
                          <button
                            type="button"
                            className="members-table-avatar-btn"
                            aria-label={`Preview ${member.full_name}`}
                            onClick={() => openQuickView(member)}
                          >
                            <Avatar
                              name={member.full_name}
                              src={member.avatar_url}
                              size="md"
                              className="members-table-avatar"
                            />
                          </button>
                        </td>
                        <td>
                          <div className="min-w-0">
                            <p
                              className={
                                isLeadership
                                  ? "members-table-name members-table-name--leadership"
                                  : "members-table-name"
                              }
                            >
                              {isLeadership ? (
                                <span
                                  className="members-table-leadership-dot"
                                  aria-hidden="true"
                                />
                              ) : null}
                              <Link
                                to={`/members/${member.id}`}
                                className="members-table-name-link"
                              >
                                {member.full_name}
                              </Link>
                            </p>
                            {subtitle ? (
                              <p className="members-table-role-line">
                                {subtitle}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="members-table-col-status">
                          <MembersDirectoryStatusPill
                            status={member.status}
                            engagement={
                              engagementByMemberId?.get(member.id) ?? null
                            }
                          />
                        </td>
                        <td className="members-table-col-dues">
                          <MembersDuesCell view={dues} />
                        </td>
                        <td className="members-table-actions-col">
                          <MembersRowActions
                            member={member}
                            canEdit={canEditMembers}
                            onEdit={openEditMember}
                            isSelf={currentMember?.id === member.id}
                          />
                        </td>
                      </tr>
                    </Fragment>
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
        engagement={
          quickViewMember
            ? (engagementByMemberId?.get(quickViewMember.id) ?? null)
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
