/**
 * Members — CRM-style people directory + board attention queue.
 * Attention queue opens via Pending focus chip or ?tab=pending.
 */

import {
  ChevronDown,
  Clock3,
  MoreHorizontal,
  Plus,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
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
  type MemberRole,
} from "../lib/roles";
import { getCurrentSemesterSlug } from "../lib/semester";

type MembersSegment = "attention" | "people";
type MembersFocus = "people" | "active" | "idle" | "pending" | "dues";

/** Directory role chips — roster buckets only (not officer titles). */
const DIRECTORY_ROLE_CHIPS: {
  role: MemberRole;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { role: "general", label: "General", icon: UserRound },
  { role: "board", label: "Board", icon: Users },
];

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

function MembersMoreMenu({
  onExport,
  exportLoading,
}: {
  onExport: () => void;
  exportLoading: boolean;
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
        className="members-crm-icon-btn"
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <AppIcon icon={MoreHorizontal} size="sm" className="text-current" />
      </Button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] rounded-lg border border-gray-200 bg-surface-card py-1 shadow-sm"
        >
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
  const memberCount = kpis?.totalMembers ?? members.length;
  const activeSegment: MembersSegment =
    canReviewMembers && segment === "attention" ? "attention" : "people";
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

  function selectRole(role: MemberRole | "") {
    setFilters((prev) => ({ ...prev, role }));
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
          <h1 className="sr-only">Members</h1>

          <div className="members-crm-toolbar">
            <div className="members-crm-toolbar-left">
              {canManageDirectory ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="members-crm-invite-btn"
                    onClick={() => setInviteOpen(true)}
                  >
                    <AppIcon icon={Plus} size="xs" className="text-current" />
                    Invite member
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

            <div className="members-crm-toolbar-right">
              <p className="members-crm-count" aria-live="polite">
                {isLoading
                  ? "Loading…"
                  : `${memberCount} ${memberCount === 1 ? "member" : "members"}`}
              </p>
              {canReviewMembers && pendingCount > 0 ? (
                <button
                  type="button"
                  className="members-crm-pending-badge"
                  onClick={focusPendingQueue}
                >
                  {pendingCount} PENDING
                </button>
              ) : null}
              <MembersFiltersToolbar
                values={filters}
                onChange={setFilters}
                focusActiveCount={activeFocus !== "people" ? 1 : 0}
                onResetFocus={resetFocusForFilters}
              />
              {canManageDirectory ? (
                <MembersMoreMenu
                  onExport={() => {
                    void handleExport();
                  }}
                  exportLoading={exportLoading}
                />
              ) : null}
            </div>
          </div>

          <div className="members-crm-chip-row" aria-label="Directory filters">
            <div
              className="members-crm-chip-group"
              role="group"
              aria-label="Filter by role"
            >
              <button
                type="button"
                className={[
                  "members-crm-chip",
                  !filters.role ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={!filters.role}
                onClick={() => selectRole("")}
              >
                All
              </button>
              {DIRECTORY_ROLE_CHIPS.map(({ role, label, icon }) => {
                const active = filters.role === role;
                return (
                  <button
                    key={role}
                    type="button"
                    className={[
                      "members-crm-chip",
                      "members-crm-chip--icon",
                      active ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={active}
                    onClick={() => selectRole(role)}
                  >
                    <AppIcon icon={icon} size="xs" className="text-current" />
                    {label}
                  </button>
                );
              })}
            </div>

            <div
              className="members-crm-chip-group members-crm-chip-group--focus"
              role="group"
              aria-label="Focus directory"
            >
              <button
                type="button"
                className={[
                  "members-crm-focus-chip",
                  activeFocus === "people" ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={activeFocus === "people"}
                onClick={clearFocusKeepRole}
              >
                All
              </button>
              {canReviewMembers ? (
                <>
                  <button
                    type="button"
                    className={[
                      "members-crm-focus-chip",
                      activeFocus === "active" ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={activeFocus === "active"}
                    title="Attended events, paid dues, completed tasks, or shared suggestions recently"
                    onClick={focusActiveMembers}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    className={[
                      "members-crm-focus-chip",
                      activeFocus === "idle" ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={activeFocus === "idle"}
                    title="Approved members with no recent engagement"
                    onClick={focusIdleMembers}
                  >
                    <AppIcon icon={Clock3} size="xs" className="text-current" />
                    Idle
                  </button>
                  <button
                    type="button"
                    className={[
                      "members-crm-focus-chip",
                      activeFocus === "pending" ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={activeFocus === "pending"}
                    onClick={focusPendingQueue}
                  >
                    <AppIcon icon={Shield} size="xs" className="text-current" />
                    Pending
                  </button>
                </>
              ) : null}
              {canFetchDues ? (
                <button
                  type="button"
                  className={[
                    "members-crm-focus-chip",
                    activeFocus === "dues" ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={activeFocus === "dues"}
                  onClick={focusOutstandingDues}
                >
                  Dues
                </button>
              ) : null}
            </div>
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

        {activeSegment === "attention" && canReviewMembers ? (
          <section
            aria-label="Needs attention"
            className="members-page-section space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-label">
                Review pending signups and dues follow-ups.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFocusKeepRole}
              >
                Back to directory
              </Button>
            </div>
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
              forceTableView
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
