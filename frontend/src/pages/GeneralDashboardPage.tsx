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
      <section className="ds-card p-8">
        <p className="ds-section-label">
          Member Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-light tracking-headline text-foreground">
          Welcome back, {member.full_name}
        </h1>
        <p className="mt-3 max-w-2xl text-label">
          View upcoming NSA events, stay connected with the community, and keep
          your member profile up to date.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="ds-card p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-light tracking-subhead text-foreground">Your profile</h2>
            <Link
              to="/profile"
              className="text-sm font-medium text-accent"
            >
              Edit profile
            </Link>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-label">Email</dt>
              <dd className="font-medium text-foreground">{member.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-label">Student ID</dt>
              <dd className="font-medium text-foreground">{member.student_id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-label">Major</dt>
              <dd className="font-medium text-foreground">{member.major}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-label">Graduation year</dt>
              <dd className="font-medium text-foreground">{member.graduation_year}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-label">Role</dt>
              <dd>
                <RoleBadge role={member.role} size="md" />
              </dd>
            </div>
          </dl>
        </section>

        <section className="ds-card p-6">
          <h2 className="text-lg font-light tracking-subhead text-foreground">Quick links</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link to="/events" className="font-medium text-accent">
                Browse events and RSVP
              </Link>
            </li>
            <li>
              <Link to="/events/volunteer" className="font-medium text-accent">
                My volunteer tasks
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
