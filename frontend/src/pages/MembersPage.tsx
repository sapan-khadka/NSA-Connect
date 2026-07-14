/**
 * Members page — layout foundation only.
 * Header / KPI grid / filters toolbar / table container shells.
 * Child UI (cards, filters, table) filled in later.
 */

import { useState } from "react";

import { Button } from "../components/ui/Button";
import { InviteMemberDrawer } from "../components/InviteMemberDrawer";

function MembersPageHeader({ onInvite }: { onInvite: () => void }) {
  return (
    <header
      aria-label="Members page header"
      className="members-page-section members-page-header"
    >
      <div className="members-page-header-inner">
        <div className="min-w-0">
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
        <div className="members-page-kpi-slot" aria-hidden="true" />
        <div className="members-page-kpi-slot" aria-hidden="true" />
        <div className="members-page-kpi-slot" aria-hidden="true" />
        <div className="members-page-kpi-slot" aria-hidden="true" />
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
      <div className="members-page-filters-shell" />
    </section>
  );
}

function MembersTableSection() {
  return (
    <section
      aria-label="Member table"
      className="members-page-section members-page-table"
    >
      <div className="members-page-table-shell" />
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
