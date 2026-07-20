/**
 * Members — premium people directory + board attention queue.
 * Segments: Needs attention (board+) · People (everyone).
 */

import { ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { AppIcon } from "../components/ui/AppIcon";
import { InviteMemberDrawer } from "../components/InviteMemberDrawer";
import { ManageBoardPositionsDrawer } from "../components/ManageBoardPositionsDrawer";
import { MembersDuesFollowUps } from "../components/MembersDuesFollowUps";
import { MembersFiltersToolbar } from "../components/MembersFiltersToolbar";
import { MembersTable } from "../components/MembersTable";
import { PendingApprovals } from "../components/PendingApprovals";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { fetchDuesDashboard } from "../lib/dues-api";
import {
  buildDuesLookup,
  buildEngagementLookup,
  deriveMembersDirectoryKpis,
  EMPTY_MEMBERS_DIRECTORY_FILTERS,
  filterDirectoryMembers,
  type MemberDuesLookup,
  type MemberEngagementLookup,
  type MembersDirectoryFilters,
  type MembersDirectoryKpis,
} from "../lib/members-directory";
import {
  downloadMembersCsv,
  fetchMembers,
  fetchMembersEngagement,
  fetchPendingMembers,
  importMembersCsv,
  type MemberImportResponse,
} from "../lib/members-api";
import {
  canManageTreasury,
  canViewMemberDirectory,
} from "../lib/roles";
import { getCurrentSemesterSlug } from "../lib/semester";

type MembersSegment = "attention" | "people";

function MembersManageMenu({
  onImportClick,
  importLoading,
  onExport,
  exportLoading,
  canManagePositions,
  onManagePositions,
}: {
  onImportClick: () => void;
  importLoading: boolean;
  onExport: () => void;
  exportLoading: boolean;
  canManagePositions: boolean;
  onManagePositions: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        Manage
        <AppIcon icon={ChevronDown} size="xs" className="text-current opacity-80" />
      </Button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[12.5rem] rounded-xl border border-gray-200 bg-surface-card py-1 shadow-sm"
        >
          {canManagePositions ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-muted"
              onClick={() => {
                setOpen(false);
                onManagePositions();
              }}
            >
              Board positions
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-muted disabled:opacity-60"
            disabled={importLoading}
            onClick={() => {
              setOpen(false);
              onImportClick();
            }}
          >
            {importLoading ? "Importing…" : "Import CSV"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-muted disabled:opacity-60"
            disabled={exportLoading}
            onClick={() => {
              setOpen(false);
              onExport();
            }}
          >
            {exportLoading ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SummaryChip({
  count,
  label,
  tone = "default",
  active = false,
  onClick,
  disabled,
  title,
}: {
  count: string;
  label: string;
  tone?: "default" | "pending" | "dues";
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const toneClass =
    tone === "pending"
      ? "text-overdue"
      : tone === "dues"
        ? "text-primary"
        : "text-foreground";

  const className = [
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
    active
      ? "border-primary/30 bg-badge-teal-bg"
      : "border-gray-200 bg-surface-card hover:border-primary/25 hover:bg-surface-muted/60",
    disabled ? "cursor-default opacity-70" : "cursor-pointer",
  ].join(" ");

  if (!onClick || disabled) {
    return (
      <span className={className} title={title}>
        <span className={`font-semibold tabular-nums ${toneClass}`}>{count}</span>{" "}
        <span className="text-label">{label}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      title={title}
    >
      <span className={`font-semibold tabular-nums ${toneClass}`}>{count}</span>{" "}
      <span className="text-label">{label}</span>
    </button>
  );
}

function MembersStatusStrip({
  kpis,
  loading,
  showDues,
  showEngagement,
  canReview,
  activeFocus,
  onFocusPeople,
  onFocusActive,
  onFocusIdle,
  onFocusPending,
  onFocusDues,
}: {
  kpis: MembersDirectoryKpis | null;
  loading: boolean;
  showDues: boolean;
  showEngagement: boolean;
  canReview: boolean;
  activeFocus: "people" | "active" | "idle" | "pending" | "dues" | null;
  onFocusPeople: () => void;
  onFocusActive: () => void;
  onFocusIdle: () => void;
  onFocusPending: () => void;
  onFocusDues: () => void;
}) {
  const value = (n: number | null | undefined) => {
    if (loading) return "…";
    if (n === null || n === undefined) return "—";
    return String(n);
  };

  const pending = kpis?.pendingCount ?? 0;
  const idle = kpis?.idleCount ?? 0;
  const dues = kpis?.outstandingDuesCount ?? 0;

  return (
    <section
      aria-label="Members summary"
      className="flex flex-wrap items-center gap-2"
    >
      <SummaryChip
        count={value(kpis?.totalMembers)}
        label="members"
        active={activeFocus === "people"}
        onClick={onFocusPeople}
      />
      {showEngagement ? (
        <>
          <SummaryChip
            count={value(kpis?.activeCount)}
            label="active"
            tone="dues"
            active={activeFocus === "active"}
            onClick={onFocusActive}
            title="Attended events, paid dues, completed tasks, or shared suggestions recently"
          />
          <SummaryChip
            count={value(kpis?.idleCount)}
            label="idle"
            tone={idle > 0 ? "pending" : "default"}
            active={activeFocus === "idle"}
            onClick={onFocusIdle}
            title="Approved members with no recent attendance, dues, tasks, or suggestions"
          />
        </>
      ) : null}
      <SummaryChip
        count={value(kpis?.pendingCount)}
        label="pending"
        tone={pending > 0 ? "pending" : "default"}
        active={activeFocus === "pending"}
        onClick={canReview ? onFocusPending : undefined}
        disabled={!canReview}
      />
      {showDues ? (
        <SummaryChip
          count={value(kpis?.outstandingDuesCount)}
          label="outstanding dues"
          tone={dues > 0 ? "dues" : "default"}
          active={activeFocus === "dues"}
          onClick={onFocusDues}
        />
      ) : null}
    </section>
  );
}

export function MembersPage() {
  const { member: currentMember } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [managePositionsOpen, setManagePositionsOpen] = useState(false);
  const [inviteNotice, setInviteNotice] = useState<{
    message: string;
    emailSent: boolean;
  } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] =
    useState<MemberImportResponse | null>(null);
  const [directoryRefreshKey, setDirectoryRefreshKey] = useState(0);
  const [filters, setFilters] = useState<MembersDirectoryFilters>(
    EMPTY_MEMBERS_DIRECTORY_FILTERS,
  );
  const userChoseSegment = useRef(false);
  const autoFocusedPending = useRef(false);

  const canReviewMembers = Boolean(
    currentMember && canViewMemberDirectory(currentMember.role),
  );
  const [segment, setSegment] = useState<MembersSegment>(() =>
    searchParams.get("tab") === "pending" && canReviewMembers
      ? "attention"
      : "people",
  );

  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [kpis, setKpis] = useState<MembersDirectoryKpis | null>(null);
  const [duesByMemberId, setDuesByMemberId] = useState<MemberDuesLookup>(
    () => new Map(),
  );
  const [engagementByMemberId, setEngagementByMemberId] =
    useState<MemberEngagementLookup>(() => new Map());
  const [engagementFilter, setEngagementFilter] = useState<
    "active" | "idle" | ""
  >("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canFetchDues = Boolean(
    currentMember &&
      canManageTreasury(currentMember.role, currentMember.position),
  );
  const canManagePositions = currentMember?.role === "president";
  const canManageDirectory = canReviewMembers;

  useEffect(() => {
    if (searchParams.get("tab") !== "pending") {
      return;
    }

    if (canReviewMembers) {
      userChoseSegment.current = true;
      setSegment("attention");
    }

    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canReviewMembers]);

  useEffect(() => {
    if (
      !canReviewMembers ||
      isLoading ||
      userChoseSegment.current ||
      autoFocusedPending.current
    ) {
      return;
    }
    if ((kpis?.pendingCount ?? 0) > 0) {
      autoFocusedPending.current = true;
      setSegment("attention");
    }
  }, [canReviewMembers, isLoading, kpis?.pendingCount]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const semester = getCurrentSemesterSlug();

    void (async () => {
      try {
        const [directory, pendingPage, duesResult, engagementResult] =
          await Promise.all([
            fetchMembers({ page: 1, page_size: 100 }),
            canReviewMembers
              ? fetchPendingMembers()
              : Promise.resolve({ members: [], total: 0 }),
            canFetchDues
              ? fetchDuesDashboard({ semester }).catch(() => null)
              : Promise.resolve(null),
            canReviewMembers
              ? fetchMembersEngagement().catch(() => null)
              : Promise.resolve(null),
          ]);

        if (cancelled) {
          return;
        }

        setMembers(directory.members);
        setEngagementByMemberId(
          buildEngagementLookup(engagementResult?.members ?? []),
        );
        setKpis(
          deriveMembersDirectoryKpis({
            totalMembers: directory.total,
            activeCount: engagementResult?.active_count ?? 0,
            idleCount: engagementResult?.idle_count ?? 0,
            pendingCount: pendingPage.total,
            unpaidCount: duesResult?.summary.unpaid_count,
            partialCount: duesResult?.summary.partial_count,
            duesAvailable: duesResult !== null,
          }),
        );
        setDuesByMemberId(buildDuesLookup(duesResult?.records ?? []));
      } catch (fetchError) {
        if (!cancelled) {
          setError(getApiErrorMessage(fetchError));
          setMembers([]);
          setKpis(null);
          setDuesByMemberId(new Map());
          setEngagementByMemberId(new Map());
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canFetchDues, canReviewMembers, directoryRefreshKey]);

  const displayedMembers = useMemo(() => {
    const filtered = filterDirectoryMembers(members, filters, duesByMemberId);
    if (!engagementFilter) {
      return filtered;
    }
    return filtered.filter((member) => {
      if (member.status !== "approved") {
        return false;
      }
      return engagementByMemberId.get(member.id) === engagementFilter;
    });
  }, [members, filters, duesByMemberId, engagementFilter, engagementByMemberId]);

  function refreshDirectory() {
    setDirectoryRefreshKey((value) => value + 1);
  }

  async function handleExport() {
    setExportLoading(true);
    setExportError(null);
    try {
      await downloadMembersCsv();
    } catch (caught) {
      setExportError(getApiErrorMessage(caught));
    } finally {
      setExportLoading(false);
    }
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setImportLoading(true);
    setImportError(null);
    try {
      const summary = await importMembersCsv(file);
      setImportSummary(summary);
      refreshDirectory();
    } catch (caught) {
      setImportError(getApiErrorMessage(caught));
    } finally {
      setImportLoading(false);
    }
  }

  const pendingCount = kpis?.pendingCount ?? 0;
  const activeSegment: MembersSegment =
    canReviewMembers && segment === "attention" ? "attention" : "people";
  const duesFilterActive = filters.paymentStatus === "outstanding";
  const activeFocus: "people" | "active" | "idle" | "pending" | "dues" | null =
    activeSegment === "attention"
      ? "pending"
      : duesFilterActive
        ? "dues"
        : engagementFilter === "active"
          ? "active"
          : engagementFilter === "idle"
            ? "idle"
            : "people";

  function selectSegment(next: MembersSegment) {
    userChoseSegment.current = true;
    setSegment(next);
  }

  function focusPeopleDirectory() {
    userChoseSegment.current = true;
    setSegment("people");
    setEngagementFilter("");
    setFilters(EMPTY_MEMBERS_DIRECTORY_FILTERS);
  }

  function focusActiveMembers() {
    userChoseSegment.current = true;
    setSegment("people");
    setEngagementFilter("active");
    setFilters({
      ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
      memberStatus: "approved",
    });
  }

  function focusIdleMembers() {
    userChoseSegment.current = true;
    setSegment("people");
    setEngagementFilter("idle");
    setFilters({
      ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
      memberStatus: "approved",
    });
  }

  function focusPendingQueue() {
    userChoseSegment.current = true;
    setSegment("attention");
  }

  function focusOutstandingDues() {
    userChoseSegment.current = true;
    setSegment("people");
    setEngagementFilter("");
    setFilters({
      ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
      paymentStatus: "outstanding",
      memberStatus: "approved",
    });
  }

  return (
    <div className="members-page">
      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          void handleImportFileChange(event);
        }}
      />
      <div className="members-page-grid">
        <header
          aria-label="Members page header"
          className="members-page-section members-page-header"
        >
          <div className="members-page-header-inner">
            <div className="members-page-header-copy">
              <h1 className="members-page-title">Members</h1>
              <p className="members-page-subtitle">
                {canReviewMembers
                  ? "Review signups, follow up on dues, and browse people."
                  : "Browse everyone in the organization."}
              </p>
            </div>

            {canManageDirectory ? (
              <div className="members-page-header-actions">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setInviteOpen(true)}
                >
                  Invite Member
                </Button>
                <MembersManageMenu
                  onImportClick={() => importInputRef.current?.click()}
                  importLoading={importLoading}
                  onExport={() => {
                    void handleExport();
                  }}
                  exportLoading={exportLoading}
                  canManagePositions={canManagePositions}
                  onManagePositions={() => setManagePositionsOpen(true)}
                />
              </div>
            ) : null}
          </div>
        </header>

        {exportError ? (
          <p role="alert" className="ds-field-error members-page-section">
            {exportError}
          </p>
        ) : null}
        {importError ? (
          <p role="alert" className="ds-field-error members-page-section">
            {importError}
          </p>
        ) : null}
        {inviteNotice ? (
          <p
            role="status"
            className={[
              "members-invite-banner members-page-section",
              inviteNotice.emailSent ? "is-success" : "is-error",
            ].join(" ")}
          >
            {inviteNotice.message}
          </p>
        ) : null}

        <div className="members-page-section space-y-4">
          <MembersStatusStrip
            kpis={kpis}
            loading={isLoading}
            showDues={canFetchDues}
            showEngagement={canReviewMembers}
            canReview={canReviewMembers}
            activeFocus={activeFocus}
            onFocusPeople={focusPeopleDirectory}
            onFocusActive={focusActiveMembers}
            onFocusIdle={focusIdleMembers}
            onFocusPending={focusPendingQueue}
            onFocusDues={focusOutstandingDues}
          />

          {canReviewMembers ? (
            <div
              role="tablist"
              aria-label="Members sections"
              className="inline-flex rounded-xl border border-gray-200 bg-surface-muted/40 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeSegment === "attention"}
                className={[
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                  activeSegment === "attention"
                    ? "bg-surface-card text-foreground shadow-sm"
                    : "text-label hover:text-foreground",
                ].join(" ")}
                onClick={() => selectSegment("attention")}
              >
                Needs attention
                {pendingCount > 0 ? (
                  <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-overdue-surface px-1.5 text-[11px] font-semibold tabular-nums text-overdue">
                    {pendingCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeSegment === "people"}
                className={[
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                  activeSegment === "people"
                    ? "bg-surface-card text-foreground shadow-sm"
                    : "text-label hover:text-foreground",
                ].join(" ")}
                onClick={() => selectSegment("people")}
              >
                People
              </button>
            </div>
          ) : null}
        </div>

        {activeSegment === "attention" && canReviewMembers ? (
          <section
            aria-label="Needs attention"
            className="members-page-section space-y-4"
            role="tabpanel"
          >
            <PendingApprovals
              showReject
              onCountChange={(count) => {
                setKpis((current) =>
                  current
                    ? { ...current, pendingCount: count }
                    : current,
                );
              }}
              onQueueChanged={refreshDirectory}
            />
            {canFetchDues ? (
              <MembersDuesFollowUps
                members={members}
                duesByMemberId={duesByMemberId}
                onReviewInDirectory={focusOutstandingDues}
              />
            ) : null}
          </section>
        ) : (
          <>
            <section
              aria-label="Search and filters"
              className="members-page-section members-page-filters"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-label">
                  {isLoading ? (
                    "Loading people…"
                  ) : (
                    <>
                      <span className="font-semibold tabular-nums text-foreground">
                        {displayedMembers.length}
                      </span>{" "}
                      {displayedMembers.length === 1 ? "person" : "people"}
                      {engagementFilter === "active"
                        ? " active recently"
                        : engagementFilter === "idle"
                          ? " idle"
                          : duesFilterActive
                            ? " with outstanding dues"
                            : ""}
                      {filters.search.trim() ||
                      filters.role ||
                      filters.graduationYear ||
                      (filters.memberStatus && !engagementFilter) ||
                      filters.paymentStatus
                        ? " matching filters"
                        : ""}
                    </>
                  )}
                </p>
                {duesFilterActive || engagementFilter ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={focusPeopleDirectory}
                  >
                    Clear filter
                  </Button>
                ) : null}
              </div>
              <MembersFiltersToolbar values={filters} onChange={setFilters} />
            </section>
            <section
              aria-label="Member table"
              className="members-page-section members-page-table"
              role={canReviewMembers ? "tabpanel" : undefined}
            >
              <MembersTable
                members={displayedMembers}
                positionSourceMembers={members}
                isLoading={isLoading}
                error={error}
                duesByMemberId={duesByMemberId}
                engagementByMemberId={engagementByMemberId}
                isFilterEmpty={
                  members.length > 0 && displayedMembers.length === 0
                }
                onInvite={
                  canManageDirectory ? () => setInviteOpen(true) : undefined
                }
                onMemberUpdated={(updated, previousHolder) => {
                  setMembers((prev) =>
                    prev.map((row) => {
                      if (row.id === updated.id) {
                        return updated;
                      }
                      if (previousHolder && row.id === previousHolder.id) {
                        return previousHolder;
                      }
                      if (
                        updated.custom_board_position &&
                        row.custom_board_position?.id ===
                          updated.custom_board_position.id &&
                        row.id !== updated.id
                      ) {
                        return { ...row, custom_board_position: null };
                      }
                      if (
                        updated.position !== "member" &&
                        row.position === updated.position &&
                        row.id !== updated.id
                      ) {
                        return {
                          ...row,
                          position: "member",
                          custom_board_position: null,
                        };
                      }
                      return row;
                    }),
                  );
                }}
              />
            </section>
          </>
        )}
      </div>

      <InviteMemberDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={(result) => {
          refreshDirectory();
          setInviteNotice({
            emailSent: result.setup_email_sent,
            message: result.setup_email_sent
              ? "Member created and setup email sent."
              : "Member created, but we couldn't send the setup email — ask them to use Forgot Password.",
          });
        }}
      />

      <ManageBoardPositionsDrawer
        open={managePositionsOpen}
        onClose={() => setManagePositionsOpen(false)}
        onCatalogChanged={refreshDirectory}
      />

      <Modal
        open={importSummary !== null}
        title="Member import complete"
        onClose={() => setImportSummary(null)}
      >
        {importSummary ? (
          <div className="space-y-4">
            <div className="space-y-1 text-sm text-foreground">
              <p>
                <span className="font-medium tabular-nums">
                  {importSummary.rows_created}
                </span>{" "}
                members created
              </p>
              <p>
                <span className="font-medium tabular-nums">
                  {importSummary.rows_skipped}
                </span>{" "}
                rows skipped
              </p>
            </div>

            <p className="text-sm text-label">
              Setup emails were not sent in bulk. New members should use Forgot
              Password to receive their password link.
            </p>

            {importSummary.skipped_rows.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Skipped rows
                </p>
                <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-label">
                  {importSummary.skipped_rows.map((row) => (
                    <li
                      key={`${row.row_number}-${row.email ?? "none"}-${row.reason}`}
                    >
                      Row {row.row_number}
                      {row.email ? ` — ${row.email}` : ""}
                      <span className="block text-foreground">{row.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
