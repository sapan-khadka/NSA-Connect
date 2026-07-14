/**
 * Members page — layout foundation.
 * Header + KPI cards + Linear filters + members table.
 */

import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";

import { Button } from "../components/ui/Button";
import { AppIcon } from "../components/ui/AppIcon";
import { InviteMemberDrawer } from "../components/InviteMemberDrawer";
import { MembersFiltersToolbar } from "../components/MembersFiltersToolbar";
import { MembersTable } from "../components/MembersTable";

type MembersKpi = {
  id: string;
  label: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  trend?: string;
};

const MEMBERS_KPIS: MembersKpi[] = [
  {
    id: "members",
    label: "Members",
    value: "128",
    subtitle: "Total in the organization",
    icon: Users,
    trend: "+4 this month",
  },
  {
    id: "active",
    label: "Active",
    value: "116",
    subtitle: "Approved and in good standing",
    icon: UserCheck,
    trend: "+2 this week",
  },
  {
    id: "pending",
    label: "Pending",
    value: "6",
    subtitle: "Awaiting approval",
    icon: UserPlus,
  },
  {
    id: "dues",
    label: "Outstanding Dues",
    value: "18",
    subtitle: "Members with unpaid balances",
    icon: BadgeDollarSign,
    trend: "−3 vs last month",
  },
];

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
          <Button type="button" variant="outline" size="sm">
            Import CSV
          </Button>
          <Button type="button" variant="outline" size="sm">
            Export
          </Button>
        </div>
      </div>
    </header>
  );
}

function MembersStatistics() {
  return (
    <section
      aria-label="Statistics"
      className="members-page-section members-page-stats"
    >
      <div className="members-page-kpi-grid">
        {MEMBERS_KPIS.map((kpi) => (
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
              {kpi.trend ? (
                <p className="members-page-kpi-trend">{kpi.trend}</p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MembersFilters() {
  return (
    <section
      aria-label="Search and filters"
      className="members-page-section members-page-filters"
    >
      <MembersFiltersToolbar />
    </section>
  );
}

function MembersTableSection() {
  return (
    <section
      aria-label="Member table"
      className="members-page-section members-page-table"
    >
      <MembersTable />
    </section>
  );
}

export function MembersPage() {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="members-page">
      <div className="members-page-grid">
        <MembersPageHeader onInvite={() => setInviteOpen(true)} />
        <MembersStatistics />
        <MembersFilters />
        <MembersTableSection />
      </div>

      <InviteMemberDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
    </div>
  );
}
