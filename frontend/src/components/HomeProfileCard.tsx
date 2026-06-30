import { Link } from "react-router-dom";

import { RoleBadge } from "./RoleBadge";
import type { MemberResponse } from "../lib/auth-api";

type HomeProfileCardProps = {
  member: MemberResponse;
};

export function HomeProfileCard({ member }: HomeProfileCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-primary">Your profile</h2>
        <Link
          to="/profile"
          className="text-sm font-medium text-accent hover:text-accent-hover"
        >
          Edit profile
        </Link>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">Email</dt>
          <dd className="font-medium text-primary">{member.email}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Major</dt>
          <dd className="font-medium text-primary">{member.major}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Graduation</dt>
          <dd className="font-medium text-primary">{member.graduation_year}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-gray-500">Role</dt>
          <dd>
            <RoleBadge role={member.role} size="md" />
          </dd>
        </div>
      </dl>
    </section>
  );
}
