import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchPendingMembers } from "../lib/members-api";
import { formatRoleLabel } from "../lib/roles";

export function BoardDashboardPage() {
  const { member } = useAuth();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingMembers()
      .then((data) => setPendingCount(data.total))
      .catch((fetchError) => setError(getApiErrorMessage(fetchError)));
  }, []);

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
          Review pending signups, manage members, and oversee NSA operations from
          one place.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Pending approvals
          </h2>
          <p className="mt-3 text-4xl font-bold text-primary">
            {pendingCount ?? "..."}
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Your role
          </h2>
          <p className="mt-3 text-2xl font-bold text-primary">
            {formatRoleLabel(member.role)}
          </p>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Board tools
          </h2>
          <p className="mt-3 text-2xl font-bold text-primary">Active</p>
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-primary">Board actions</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          <li>
            <Link
              to="/members"
              className="block rounded-md border border-gray-200 px-4 py-3 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <p className="font-medium text-primary">Review pending members</p>
              <p className="mt-1 text-sm text-gray-500">
                Approve or reject new signup requests.
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
