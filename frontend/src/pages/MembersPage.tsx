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
import { useEffect, useMemo, useState } from "react";

import { Button } from "../components/ui/Button";
import { AppIcon } from "../components/ui/AppIcon";
import { InviteMemberDrawer } from "../components/InviteMemberDrawer";
import { MembersFiltersToolbar } from "../components/MembersFiltersToolbar";
import { MembersTable } from "../components/MembersTable";
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
import { fetchMembers, fetchPendingMembers } from "../lib/members-api";
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

function MembersPageHeader({ onInvite }: { onInvite: () => void }) {
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
          <Button type="button" variant="primary" size="sm" onClick={onInvite}>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Coming soon"
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
  const [inviteOpen, setInviteOpen] = useState(false);
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
  }, [canFetchDues]);

  const displayedMembers = useMemo(
    () => filterDirectoryMembers(members, filters, duesByMemberId),
    [members, filters, duesByMemberId],
  );

  return (
    <div className="members-page">
      <div className="members-page-grid">
        <MembersPageHeader onInvite={() => setInviteOpen(true)} />
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
            isLoading={isLoading}
            error={error}
            duesByMemberId={duesByMemberId}
            isFilterEmpty={members.length > 0 && displayedMembers.length === 0}
            onInvite={() => setInviteOpen(true)}
            onMemberUpdated={(updated) => {
              setMembers((prev) =>
                prev.map((row) => (row.id === updated.id ? updated : row)),
              );
            }}
          />
        </section>
      </div>

      <InviteMemberDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
    </div>
  );
}
