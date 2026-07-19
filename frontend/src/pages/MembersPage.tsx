/**
 * Members page — live directory stats from members + dues APIs.
 * Header + KPI cards + filters + members table (no hard-coded KPI demo numbers).
 */

import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { Button } from "../components/ui/Button";
import { AppIcon } from "../components/ui/AppIcon";
import { InviteMemberDrawer } from "../components/InviteMemberDrawer";
import { ManageBoardPositionsDrawer } from "../components/ManageBoardPositionsDrawer";
import { MembersFiltersToolbar } from "../components/MembersFiltersToolbar";
import { MembersTable } from "../components/MembersTable";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { fetchDuesDashboard } from "../lib/dues-api";
import {
  buildDuesLookup,
  deriveMembersDirectoryKpis,
  EMPTY_MEMBERS_DIRECTORY_FILTERS,
  filterDirectoryMembers,
  type MemberDuesLookup,
  type MembersDirectoryFilters,
  type MembersDirectoryKpis,
} from "../lib/members-directory";
import {
  downloadMembersCsv,
  fetchMembers,
  fetchPendingMembers,
  importMembersCsv,
  type MemberImportResponse,
} from "../lib/members-api";
import { canManageTreasury } from "../lib/roles";
import { getCurrentSemesterSlug } from "../lib/semester";

type MembersKpi = {
  id: string;
  label: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
};

function formatKpiCount(value: number | null | undefined, loading: boolean): string {
  if (loading) {
    return "…";
  }
  if (value === null || value === undefined) {
    return "—";
  }
  return String(value);
}

function buildKpiCards(
  kpis: MembersDirectoryKpis | null,
  loading: boolean,
): MembersKpi[] {
  return [
    {
      id: "members",
      label: "Members",
      value: formatKpiCount(kpis?.totalMembers, loading),
      subtitle: "Total in the organization",
      icon: Users,
    },
    {
      id: "active",
      label: "Active",
      value: formatKpiCount(kpis?.activeCount, loading),
      subtitle: "Approved and in good standing",
      icon: UserCheck,
    },
    {
      id: "pending",
      label: "Pending",
      value: formatKpiCount(kpis?.pendingCount, loading),
      subtitle: "Awaiting approval",
      icon: UserPlus,
    },
    {
      id: "dues",
      label: "Outstanding Dues",
      value: formatKpiCount(kpis?.outstandingDuesCount, loading),
      subtitle:
        kpis?.outstandingDuesCount === null && !loading
          ? "Treasury access required"
          : "Members with unpaid balances",
      icon: BadgeDollarSign,
    },
  ];
}

function MembersPageHeader({
  onInvite,
  onImportClick,
  importLoading,
  onExport,
  exportLoading,
  canManagePositions,
  onManagePositions,
}: {
  onInvite: () => void;
  onImportClick: () => void;
  importLoading: boolean;
  onExport: () => void;
  exportLoading: boolean;
  canManagePositions: boolean;
  onManagePositions: () => void;
}) {
  return (
    <header
      aria-label="Members page header"
      className="members-page-section members-page-header"
    >
      <div className="members-page-header-inner">
        <div className="members-page-header-copy">
          <h1 className="members-page-title">Members</h1>
          <p className="members-page-subtitle">
            Manage everyone in your organization.
          </p>
        </div>

        <div className="members-page-header-actions">
          {canManagePositions ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onManagePositions}
            >
              Manage board positions
            </Button>
          ) : null}
          <Button type="button" variant="primary" size="sm" onClick={onInvite}>
            Invite Member
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onImportClick}
            loading={importLoading}
            disabled={importLoading}
          >
            Import CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExport}
            loading={exportLoading}
            disabled={exportLoading}
          >
            Export
          </Button>
        </div>
      </div>
    </header>
  );
}

function MembersStatistics({
  kpis,
  loading,
}: {
  kpis: MembersDirectoryKpis | null;
  loading: boolean;
}) {
  const cards = buildKpiCards(kpis, loading);

  return (
    <section
      aria-label="Statistics"
      className="members-page-section members-page-stats"
    >
      <div className="members-page-kpi-grid">
        {cards.map((kpi) => (
          <article
            key={kpi.id}
            className="members-page-kpi-card"
            aria-label={`${kpi.label}: ${kpi.value}`}
          >
            <div className="members-page-kpi-card-top">
              <p className="members-page-kpi-label">{kpi.label}</p>
              <span className="members-page-kpi-icon" aria-hidden="true">
                <AppIcon icon={kpi.icon} size="sm" className="text-current" />
              </span>
            </div>
            <p className="members-page-kpi-value tabular-nums">{kpi.value}</p>
            <div className="members-page-kpi-footer">
              <p className="members-page-kpi-subtitle">{kpi.subtitle}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function MembersPage() {
  const { member: currentMember } = useAuth();
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

  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [kpis, setKpis] = useState<MembersDirectoryKpis | null>(null);
  const [duesByMemberId, setDuesByMemberId] = useState<MemberDuesLookup>(
    () => new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canFetchDues = Boolean(
    currentMember &&
      canManageTreasury(currentMember.role, currentMember.position),
  );
  const canManagePositions = currentMember?.role === "president";

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const semester = getCurrentSemesterSlug();

    void (async () => {
      try {
        const [directory, approvedPage, pendingPage, duesResult] =
          await Promise.all([
            fetchMembers({ page: 1, page_size: 100 }),
            fetchMembers({ page: 1, page_size: 1, status: "approved" }),
            fetchPendingMembers(),
            canFetchDues
              ? fetchDuesDashboard({ semester }).catch(() => null)
              : Promise.resolve(null),
          ]);

        if (cancelled) {
          return;
        }

        setMembers(directory.members);
        setKpis(
          deriveMembersDirectoryKpis({
            totalMembers: directory.total,
            activeCount: approvedPage.total,
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
  }, [canFetchDues, directoryRefreshKey]);

  const displayedMembers = useMemo(
    () => filterDirectoryMembers(members, filters, duesByMemberId),
    [members, filters, duesByMemberId],
  );

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
      setDirectoryRefreshKey((value) => value + 1);
    } catch (caught) {
      setImportError(getApiErrorMessage(caught));
    } finally {
      setImportLoading(false);
    }
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
        <MembersPageHeader
          onInvite={() => setInviteOpen(true)}
          onImportClick={() => importInputRef.current?.click()}
          importLoading={importLoading}
          onExport={() => {
            void handleExport();
          }}
          exportLoading={exportLoading}
          canManagePositions={canManagePositions}
          onManagePositions={() => setManagePositionsOpen(true)}
        />
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
        <MembersStatistics kpis={kpis} loading={isLoading} />
        <section
          aria-label="Search and filters"
          className="members-page-section members-page-filters"
        >
          <MembersFiltersToolbar values={filters} onChange={setFilters} />
        </section>
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
            isFilterEmpty={members.length > 0 && displayedMembers.length === 0}
            onInvite={() => setInviteOpen(true)}
            onMemberUpdated={(updated, previousHolder) => {
              setMembers((prev) =>
                prev.map((row) => {
                  if (row.id === updated.id) {
                    return updated;
                  }
                  if (previousHolder && row.id === previousHolder.id) {
                    return previousHolder;
                  }
                  // Clear stale custom occupancy when a seat transfers.
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
      </div>

      <InviteMemberDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={(result) => {
          setDirectoryRefreshKey((value) => value + 1);
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
        onCatalogChanged={() => {
          setDirectoryRefreshKey((value) => value + 1);
        }}
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
