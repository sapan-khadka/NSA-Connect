import { useState } from "react";
import { Link } from "react-router-dom";

import { PendingApprovals } from "../components/PendingApprovals";
import { RoleBadge } from "../components/RoleBadge";
import { useAuth } from "../context/useAuth";

export function BoardDashboardPage() {
  const { member } = useAuth();
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  if (!member) {
    return null;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-card bg-surface-card p-8">
        <p className="ds-section-label">
          Board Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-light tracking-headline text-foreground">
          Board workspace, {member.full_name}
        </h1>
        <p className="mt-3 max-w-2xl text-label">
          Approve new signups with one click, manage members, and oversee NSA
          operations from one place.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="rounded-card bg-surface-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-label">
            Pending approvals
          </h2>
          <p
            data-testid="pending-approval-count"
            className="mt-3 text-4xl font-light tracking-headline text-foreground"
          >
            {pendingCount ?? "..."}
          </p>
        </section>

        <section className="rounded-card bg-surface-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-label">
            Your role
          </h2>
          <div className="mt-3">
            <RoleBadge role={member.role} size="md" />
          </div>
        </section>

        <section className="rounded-card bg-surface-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-label">
            Board tools
          </h2>
          <p className="mt-3 text-2xl font-light tracking-headline text-foreground">Active</p>
        </section>
      </div>

      <PendingApprovals onCountChange={setPendingCount} showReject={false} />

      <section className="rounded-card bg-surface-card p-6">
        <h2 className="text-lg font-light tracking-subhead text-foreground">Board actions</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          <li>
            <Link
              to="/events/tasks"
              className="block rounded-card bg-surface-card px-4 py-3 transition hover:bg-surface-muted"
            >
              <p className="font-medium text-foreground">Task board</p>
              <p className="mt-1 text-sm text-label">
                Drag checklist tasks across To do, In progress, and Done.
              </p>
            </Link>
          </li>
          <li>
            <Link
              to="/board/meeting-minutes"
              className="block rounded-md border border-gray-200 px-4 py-3 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <p className="font-medium text-foreground">Meeting minutes</p>
              <p className="mt-1 text-sm text-label">
                Summarize raw notes into decisions and action items.
              </p>
            </Link>
          </li>
          <li>
            <Link
              to="/board/announcement-email"
              className="block rounded-md border border-gray-200 px-4 py-3 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <p className="font-medium text-foreground">Announcement email</p>
              <p className="mt-1 text-sm text-label">
                Generate a formatted member email from an event name.
              </p>
            </Link>
          </li>
          <li>
            <Link
              to="/members?tab=pending"
              className="block rounded-md border border-gray-200 px-4 py-3 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <p className="font-medium text-foreground">Full approval queue</p>
              <p className="mt-1 text-sm text-label">
                Review all pending signups and reject if needed.
              </p>
            </Link>
          </li>
          <li>
            <Link
              to="/members"
              className="block rounded-md border border-gray-200 px-4 py-3 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <p className="font-medium text-foreground">Member directory</p>
              <p className="mt-1 text-sm text-label">
                Browse and search all NSA Connect members.
              </p>
            </Link>
          </li>
          <li>
            <Link
              to="/finance"
              className="block rounded-md border border-gray-200 px-4 py-3 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <p className="font-medium text-foreground">Finance overview</p>
              <p className="mt-1 text-sm text-label">
                Monitor dues, expenses, and treasury activity.
              </p>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
