import { UserRound } from "lucide-react";

import { RoleBadge } from "./RoleBadge";
import { HomeCard } from "./ui/HomeCard";
import { IconBadge } from "./ui/IconBadge";
import { ArrowLink } from "./ui/ArrowLink";
import type { MemberResponse } from "../lib/auth-api";
import { MemberDuesStatus } from "./MemberDuesStatus";

type HomeProfileCardProps = {
  member: MemberResponse;
};

export function HomeProfileCard({ member }: HomeProfileCardProps) {
  return (
    <HomeCard className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4">
        <div className="ds-icon-label">
          <IconBadge icon={UserRound} category="members" size="sm" />
          <h2 className="text-lg font-semibold text-foreground">Your Profile</h2>
        </div>
        <ArrowLink to="/profile">Edit profile</ArrowLink>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <MemberDuesStatus />

        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium tracking-[0.03em] text-gray-500">
              Email
            </dt>
            <dd className="mt-1 truncate font-normal text-foreground">
              {member.email}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium tracking-[0.03em] text-gray-500">
              Major
            </dt>
            <dd className="mt-1 font-normal text-foreground">{member.major}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium tracking-[0.03em] text-gray-500">
              Graduation
            </dt>
            <dd className="mt-1 font-normal tabular-nums text-foreground">
              {member.graduation_year}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium tracking-[0.03em] text-gray-500">
              Role
            </dt>
            <dd className="mt-2">
              <RoleBadge role={member.role} size="md" />
            </dd>
          </div>
        </dl>
      </div>
    </HomeCard>
  );
}
