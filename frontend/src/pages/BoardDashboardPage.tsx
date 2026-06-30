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
      <section className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 to-white p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Board Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary">
          Board workspace, {member.full_name}
        </h1>
        <p className="mt-3 max-w-2xl text-gray-600">
          Approve new signups with one click, manage members, and oversee NSA
          operations from one place.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Pending approvals
          </h2>
          <p
            data-testid="pending-approval-count"
            className="mt-3 text-4xl font-bold text-primary"
          >
            {pendingCount ?? "..."}
          </p>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Your role
          </h2>
          <div className="mt-3">
            <RoleBadge role={member.role} size="md" />
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Board tools
          </h2>
          <p className="mt-3 text-2xl font-bold text-primary">Active</p>
        </section>
      </div>

      <PendingApprovals onCountChange={setPendingCount} showReject={false} />

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-primary">Board actions</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          <li>
            <Link
              to="/events/tasks"
              className="block rounded-md border border-accent/30 bg-gradient-to-br from-accent/10 to-white px-4 py-3 transition-all hover:border-accent hover:shadow-md"
            >
              <p className="font-medium text-primary">Task board</p>
              <p className="mt-1 text-sm text-gray-500">
                Drag checklist tasks across To do, In progress, and Done.
              </p>
            </Link>
          </li>
          <li>
            <Link
              to="/board/meeting-minutes"
              className="block rounded-md border border-gray-200 px-4 py-3 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <p className="font-medium text-primary">Meeting minutes</p>
              <p className="mt-1 text-sm text-gray-500">
                Summarize raw notes into decisions and action items.
              </p>
            </Link>
          </li>
          <li>
            <Link
              to="/board/announcement-email"
              className="block rounded-md border border-gray-200 px-4 py-3 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <p className="font-medium text-primary">Announcement email</p>
              <p className="mt-1 text-sm text-gray-500">
                Generate a formatted member email from an event name.
              </p>
            </Link>
          </li>
          <li>
            <Link
              to="/members?tab=pending"
              className="block rounded-md border border-gray-200 px-4 py-3 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <p className="font-medium text-primary">Full approval queue</p>
              <p className="mt-1 text-sm text-gray-500">
                Review all pending signups and reject if needed.
              </p>
            </Link>
          </li>
          <li>
            <Link
              to="/members"
              className="block rounded-md border border-gray-200 px-4 py-3 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <p className="font-medium text-primary">Member directory</p>
              <p className="mt-1 text-sm text-gray-500">
                Browse and search all NSA Connect members.
              </p>
            </Link>
          </li>
          <li>
            <Link
              to="/finance"
              className="block rounded-md border border-gray-200 px-4 py-3 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <p className="font-medium text-primary">Finance overview</p>
              <p className="mt-1 text-sm text-gray-500">
                Monitor dues, expenses, and treasury activity.
              </p>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
