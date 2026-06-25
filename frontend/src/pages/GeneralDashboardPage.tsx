import { Link } from "react-router-dom";

import { RoleBadge } from "../components/RoleBadge";
import { useAuth } from "../context/useAuth";

export function GeneralDashboardPage() {
  const { member } = useAuth();

  if (!member) {
    return null;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Member Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary">
          Welcome back, {member.full_name}
        </h1>
        <p className="mt-3 max-w-2xl text-gray-600">
          View upcoming NSA events, stay connected with the community, and keep
          your member profile up to date.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-primary">Your profile</h2>
            <Link
              to="/profile"
              className="text-sm font-medium text-accent hover:text-accent-hover"
            >
              Edit profile
            </Link>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-primary">{member.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Student ID</dt>
              <dd className="font-medium text-primary">{member.student_id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Major</dt>
              <dd className="font-medium text-primary">{member.major}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Graduation year</dt>
              <dd className="font-medium text-primary">{member.graduation_year}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500">Role</dt>
              <dd>
                <RoleBadge role={member.role} size="md" />
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-primary">Quick links</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link to="/events" className="font-medium text-accent hover:text-accent-hover">
                Browse events and RSVP
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
