import type { ReactNode } from "react";

import type { MemberResponse } from "../lib/auth-api";

type MemberCardProps = {
  member: MemberResponse;
  actions?: ReactNode;
};

export function MemberCard({ member, actions }: MemberCardProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="font-medium text-primary">{member.full_name}</p>
        <p className="mt-1 text-sm text-gray-600">{member.email}</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-gray-500">Student ID</dt>
            <dd className="font-medium text-primary">{member.student_id}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Major</dt>
            <dd className="font-medium text-primary">{member.major}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Graduation</dt>
            <dd className="font-medium text-primary">{member.graduation_year}</dd>
          </div>
        </dl>
      </div>

      {actions ? <div className="flex shrink-0 gap-3">{actions}</div> : null}
    </div>
  );
}
