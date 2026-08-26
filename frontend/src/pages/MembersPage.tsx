/**
 * Members — CRM-style people directory + membership reviews queue.
 * Reviews opens via the Directory/Reviews tabs, Pending status filter, or ?tab=pending.
 */

import {
  ChevronDown,
  Plus,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useSearchParams } from "react-router";

import { Button } from "../components/ui/Button";
import { AppIcon } from "../components/ui/AppIcon";
import { AddMemberDrawer } from "../components/AddMemberDrawer";
import { ManageBoardPositionsDrawer } from "../components/ManageBoardPositionsDrawer";
import { MembersDuesFollowUps } from "../components/MembersDuesFollowUps";
import {
  countMembersAdvancedFilters,
  MembersFiltersDrawer,
  MembersFiltersToolbar,
} from "../components/MembersFiltersToolbar";
import { MembersTable } from "../components/MembersTable";
import { PendingApprovals } from "../components/PendingApprovals";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { fetchDuesDashboard } from "../lib/dues-api";
import { formatCurrencyCompact } from "../lib/format-currency";
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
  memberHoldsBoardSeat,
  memberSatisfiesMinRole,
  viewerCanManageMembers,
} from "../lib/roles";
import { getCurrentSemesterSlug } from "../lib/semester";

type MembersSegment = "attention" | "people";
type MembersView = "directory" | "reviews";
type MembersFocus = "people" | "active" | "idle" | "pending" | "dues";

/** Directory scope segments — leadership seats vs board vs general roster. */
const DIRECTORY_ROLE_SEGMENTS: {
  role: "leadership" | "board" | "general";
  label: string;
}[] = [
  { role: "leadership", label: "Leadership" },
  { role: "board", label: "Board" },
  { role: "general", label: "Members" },
];

function MembersManageMenu({
  onImportClick,
  importLoading,
  onExport,
  exportLoading,
  canManagePositions,
  onManagePositions,
  className,
}: {
  onImportClick: () => void;
  importLoading: boolean;
  onExport: () => void;
  exportLoading: boolean;
  canManagePositions: boolean;
  onManagePositions: () => void;
  className?: string;
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
    <div
      ref={rootRef}
      className={["relative", className].filter(Boolean).join(" ")}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="members-crm-manage-btn"
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
          className="absolute left-0 top-full z-50 mt-2 min-w-[12.5rem] rounded-lg border border-gray-200 bg-surface-card py-1 shadow-sm"
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
              Custom titles
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

export function MembersPage() {
  const { member: currentMember } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [managePositionsOpen, setManagePositionsOpen] = useState(false);
  const [addMemberNotice, setAddMemberNotice] = useState<{
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const userChoseSegment = useRef(false);

  const canReviewMembers = viewerCanManageMembers(currentMember);
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
  const canManagePositions = Boolean(
    currentMember && memberSatisfiesMinRole(currentMember, "president"),
  );
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
        const boardCount = directory.members.filter(
          (row) =>
            row.role === "board" ||
            row.role === "president" ||
            row.role === "treasurer" ||
            memberHoldsBoardSeat(row),
        ).length;
        const outstandingAmount = duesResult
          ? Number.parseFloat(duesResult.summary.total_outstanding)
          : null;
        setKpis(
          deriveMembersDirectoryKpis({
            totalMembers: directory.total,
            activeCount: engagementResult?.active_count ?? 0,
            idleCount: engagementResult?.idle_count ?? 0,
            pendingCount: pendingPage.total,
            boardCount,
            unpaidCount: duesResult?.summary.unpaid_count,
            partialCount: duesResult?.summary.partial_count,
            outstandingAmount: Number.isFinite(outstandingAmount)
              ? outstandingAmount
              : null,
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

  const refreshDirectory = useCallback(() => {
    setDirectoryRefreshKey((value) => value + 1);
  }, []);

  const handlePendingCountChange = useCallback((count: number) => {
    setKpis((current) =>
      current && current.pendingCount !== count
        ? { ...current, pendingCount: count }
        : current,
    );
  }, []);

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
  const rejectedCount = useMemo(
    () => members.filter((row) => row.status === "rejected").length,
    [members],
  );
  const isArchiveView = filters.memberStatus === "rejected";
  const memberCount = useMemo(() => {
    if (isArchiveView) {
      return rejectedCount;
    }
    return members.filter((row) => row.status !== "rejected").length;
  }, [isArchiveView, members, rejectedCount]);
  const activeCount = kpis?.activeCount ?? 0;
  const boardCount = kpis?.boardCount ?? 0;
  const outstandingAmount = kpis?.outstandingDuesAmount ?? null;
  const activeSegment: MembersSegment =
    canReviewMembers && segment === "attention" ? "attention" : "people";
  const isReviewsView = activeSegment === "attention" && canReviewMembers;
  const membersView: MembersView = isReviewsView ? "reviews" : "directory";
  const duesFilterActive = filters.paymentStatus === "outstanding";
  const activeFocus: MembersFocus =
    activeSegment === "attention"
      ? "pending"
      : duesFilterActive
        ? "dues"
        : engagementFilter === "active"
          ? "active"
          : engagementFilter === "idle"
            ? "idle"
            : "people";
  const filtersDrawerOpen = filtersOpen && !isReviewsView;
  const advancedFilterCount =
    countMembersAdvancedFilters(filters) +
    (activeFocus === "active" || activeFocus === "idle" || activeFocus === "dues"
      ? 1
      : 0);
  const reviewsTabLabel = "Reviews";
  const headerMeta = !isLoading
    ? isArchiveView
      ? `${rejectedCount} rejected`
      : [
          `${memberCount} ${memberCount === 1 ? "member" : "members"}`,
          `${activeCount} active`,
          `${boardCount} board`,
          outstandingAmount !== null
            ? `${formatCurrencyCompact(outstandingAmount)} outstanding`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
    : null;

  useEffect(() => {
    if (isReviewsView) {
      setFiltersOpen(false);
      document.body.style.overflow = "";
    }
  }, [isReviewsView]);

  function selectRole(role: "" | "leadership" | "board" | "general") {
    setFilters((prev) => ({
      ...prev,
      role,
      // Leaving Archive returns to the active directory.
      memberStatus: prev.memberStatus === "rejected" ? "" : prev.memberStatus,
    }));
  }

  function openArchive() {
    userChoseSegment.current = true;
    setSegment("people");
    setEngagementFilter("");
    setFilters((prev) => ({
      ...prev,
      role: "",
      paymentStatus: "",
      memberStatus: "rejected",
    }));
  }

  function clearFocusKeepRole() {
    userChoseSegment.current = true;
    setSegment("people");
    setEngagementFilter("");
    setFilters((prev) => ({
      ...prev,
      paymentStatus: "",
      memberStatus: "",
    }));
  }

  function focusActiveMembers() {
    userChoseSegment.current = true;
    setSegment("people");
    setEngagementFilter("active");
    setFilters((prev) => ({
      ...prev,
      paymentStatus: "",
      memberStatus: "approved",
    }));
  }

  function focusIdleMembers() {
    userChoseSegment.current = true;
    setSegment("people");
    setEngagementFilter("idle");
    setFilters((prev) => ({
      ...prev,
      paymentStatus: "",
      memberStatus: "approved",
    }));
  }

  function focusPendingQueue() {
    userChoseSegment.current = true;
    setSegment("attention");
  }

  function focusOutstandingDues() {
    userChoseSegment.current = true;
    setSegment("people");
    setEngagementFilter("");
    setFilters((prev) => ({
      ...prev,
      paymentStatus: "outstanding",
      memberStatus: "approved",
    }));
  }

  function resetFocusForFilters() {
    userChoseSegment.current = true;
    setSegment("people");
    setEngagementFilter("");
    setFilters((prev) => ({
      ...prev,
      paymentStatus: "",
      memberStatus: "",
    }));
  }

  function applyDirectoryFocus(next: MembersFocus) {
    if (next === "people") {
      clearFocusKeepRole();
      return;
    }
    if (next === "active") {
      focusActiveMembers();
      return;
    }
    if (next === "idle") {
      focusIdleMembers();
      return;
    }
    if (next === "pending") {
      focusPendingQueue();
      return;
    }
    focusOutstandingDues();
  }

  return (
    <div className="members-page members-page--crm">
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
              {headerMeta ? (
                <p className="members-page-subtitle" aria-label="Members summary">
                  {headerMeta}
                </p>
              ) : (
                <p className="members-page-subtitle">People, roles, and dues.</p>
              )}
            </div>

            <div className="members-page-header-actions">
              {canManageDirectory ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="members-crm-invite-btn"
                    aria-label="Add Member"
                    onClick={() => setAddMemberOpen(true)}
                  >
                    <AppIcon icon={Plus} size="xs" className="text-current" />
                    <span className="members-crm-invite-label-full" aria-hidden="true">
                      Add Member
                    </span>
                    <span className="members-crm-invite-label-short" aria-hidden="true">
                      Add
                    </span>
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
                </>
              ) : null}
            </div>
          </div>

          {canReviewMembers ? (
            <nav
              aria-label="Members sections"
              className="members-page-tabs"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={membersView === "directory"}
                className={
                  membersView === "directory"
                    ? "members-page-tab is-active"
                    : "members-page-tab"
                }
                onClick={() => {
                  userChoseSegment.current = true;
                  clearFocusKeepRole();
                }}
              >
                Directory
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={membersView === "reviews"}
                className={
                  membersView === "reviews"
                    ? "members-page-tab is-active"
                    : "members-page-tab"
                }
                onClick={() => {
                  userChoseSegment.current = true;
                  focusPendingQueue();
                }}
              >
                {reviewsTabLabel}
                {pendingCount > 0 ? (
                  <span className="members-page-tab-badge">{pendingCount}</span>
                ) : null}
              </button>
            </nav>
          ) : null}

          {!isReviewsView ? (
            <div className="members-crm-toolbar">
              <MembersFiltersToolbar
                values={filters}
                onChange={setFilters}
                filtersOpen={filtersDrawerOpen}
                advancedFilterCount={advancedFilterCount}
                onOpenFilters={() => setFiltersOpen(true)}
              />

              <div
                className="members-crm-segment"
                role="group"
                aria-label="Filter by roster"
              >
                <button
                  type="button"
                  className={
                    !filters.role && !isArchiveView ? "is-active" : undefined
                  }
                  aria-pressed={!filters.role && !isArchiveView}
                  onClick={() => selectRole("")}
                >
                  All
                </button>
                {DIRECTORY_ROLE_SEGMENTS.map(({ role, label }) => {
                  const active = !isArchiveView && filters.role === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      className={active ? "is-active" : undefined}
                      aria-pressed={active}
                      onClick={() => selectRole(role)}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={[
                    "members-crm-segment-archive",
                    isArchiveView ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={isArchiveView}
                  onClick={openArchive}
                >
                  Archive
                  {rejectedCount > 0 ? (
                    <span className="members-crm-segment__count">
                      {rejectedCount}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>
          ) : null}
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
        {addMemberNotice ? (
          <p
            role="status"
            className={[
              "members-invite-banner members-page-section",
              addMemberNotice.emailSent ? "is-success" : "is-error",
            ].join(" ")}
          >
            {addMemberNotice.message}
          </p>
        ) : null}

        {isReviewsView ? (
          <section className="members-page-section members-reviews-stack">
            <PendingApprovals
              showReject
              onCountChange={handlePendingCountChange}
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
          <section
            aria-label="Member table"
            className="members-page-section members-page-table"
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
              isArchive={isArchiveView}
              enableBulkSelection={canManageDirectory && !isArchiveView}
              onInvite={
                canManageDirectory && !isArchiveView
                  ? () => setAddMemberOpen(true)
                  : undefined
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
        )}
      </div>

      <AddMemberDrawer
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        onAdded={(result) => {
          refreshDirectory();
          setAddMemberNotice({
            emailSent: result.setup_email_sent,
            message: result.setup_email_sent
              ? "Member added. Setup email sent."
              : "Member added, but we couldn't send the setup email. Ask them to use Forgot Password.",
          });
        }}
      />

      <ManageBoardPositionsDrawer
        open={managePositionsOpen}
        onClose={() => setManagePositionsOpen(false)}
        onCatalogChanged={refreshDirectory}
      />

      <MembersFiltersDrawer
        open={filtersDrawerOpen}
        onClose={() => setFiltersOpen(false)}
        values={filters}
        onChange={setFilters}
        focus={activeFocus}
        onFocusChange={applyDirectoryFocus}
        canReviewMembers={canReviewMembers}
        canFetchDues={canFetchDues}
        onResetFocus={resetFocusForFilters}
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
                      {row.email ? ` · ${row.email}` : ""}
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
