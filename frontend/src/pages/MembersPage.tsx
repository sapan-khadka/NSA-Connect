/**
 * Members page — layout foundation.
 * Header, statistics, filters, and member table are in place.
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
import { MetricCard } from "../design-system/components/data-display/MetricCard";

type MembersKpiCard = {
  id: string;
  label: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  /** Present only when a real delta exists. */
  trend?: string;
  trendTone?: "default" | "success" | "danger" | "warning";
};

/** Placeholder metrics — no API wiring yet. Trends omitted until data exists. */
const MEMBERS_KPI_CARDS: MembersKpiCard[] = [
  {
    id: "total",
    label: "Total Members",
    value: "—",
    subtitle: "All approved members",
    icon: Users,
  },
  {
    id: "active",
    label: "Active Members",
    value: "—",
    subtitle: "Members in good standing",
    icon: UserCheck,
  },
  {
    id: "pending",
    label: "Pending Requests",
    value: "—",
    subtitle: "Awaiting approval",
    icon: UserPlus,
  },
  {
    id: "dues",
    label: "Outstanding Dues",
    value: "—",
    subtitle: "Unpaid membership dues",
    icon: BadgeDollarSign,
  },
];

function MembersPageHeader({ onInvite }: { onInvite: () => void }) {
  return (
    <header
      aria-label="Members page header"
      className="members-page-section members-page-header"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-light tracking-headline text-foreground">
            Members
          </h1>
          <p className="mt-1.5 text-sm font-light text-label">
            Manage your organization members.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          <Button type="button" variant="primary" size="sm" onClick={onInvite}>
            Invite Member
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Coming soon"
            aria-label="Import CSV (coming soon)"
          >
            Import CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Coming soon"
            aria-label="Export (coming soon)"
          >
            Export
          </Button>
        </div>
      </div>
    </header>
  );
}

function MembersStatistics() {
  return (
    <section aria-label="Statistics" className="members-page-section">
      <div className="members-page-kpi-grid">
        {MEMBERS_KPI_CARDS.map((card) => (
          <MetricCard
            key={card.id}
            className="members-page-kpi-card home-surface-quiet"
            label={card.label}
            value={card.value}
            description={card.subtitle}
            trend={card.trend}
            trendTone={card.trendTone}
            icon={
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-label ring-1 ring-black/5">
                <AppIcon icon={card.icon} size="sm" className="text-current" />
              </span>
            }
          />
        ))}
      </div>
    </section>
  );
}

function MembersFilters() {
  return (
    <section
      aria-label="Filters"
      className="members-page-section members-page-filters"
    >
      <MembersFiltersToolbar />
    </section>
  );
}

function MembersTableSection() {
  return (
    <section
      aria-label="Member Table"
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
