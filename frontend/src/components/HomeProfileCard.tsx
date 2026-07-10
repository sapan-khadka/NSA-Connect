import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";

import { RoleBadge } from "./RoleBadge";
import { HomeCard } from "./ui/HomeCard";
import { IconBadge } from "./ui/IconBadge";
import type { MemberResponse } from "../lib/auth-api";
import { MemberDuesStatus } from "./MemberDuesStatus";

type HomeProfileCardProps = {
  member: MemberResponse;
};

export function HomeProfileCard({ member }: HomeProfileCardProps) {
  return (
    <HomeCard className="flex h-full flex-col">
      <div className="ds-icon-label">
        <IconBadge icon={UserRound} category="members" size="sm" />
        <h2 className="text-lg font-semibold text-foreground">User Profile</h2>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <MemberDuesStatus />

        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-sm font-semibold text-label">Major</dt>
            <dd className="mt-1 font-medium text-foreground">{member.major}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-label">Graduation</dt>
            <dd className="mt-1 font-medium text-foreground">
              {member.graduation_year}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-label">Role</dt>
            <dd className="mt-2">
              <RoleBadge role={member.role} size="md" />
            </dd>
          </div>
        </dl>

        <div className="mt-auto pt-4">
          <Link
            to="/profile"
            className="inline-flex w-full items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-foreground transition duration-200 hover:border-primary/40 hover:bg-badge-teal-bg sm:w-auto"
          >
            Edit Profile
          </Link>
        </div>
      </div>
    </HomeCard>
  );
}
