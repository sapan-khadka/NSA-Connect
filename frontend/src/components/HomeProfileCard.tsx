import { RoleBadge } from "./RoleBadge";
import { HomeCard } from "./ui/HomeCard";
import { ArrowLink } from "./ui/ArrowLink";
import type { MemberResponse } from "../lib/auth-api";
import { MemberDuesStatus } from "./MemberDuesStatus";

type HomeProfileCardProps = {
  member: MemberResponse;
};

export function HomeProfileCard({ member }: HomeProfileCardProps) {
  return (
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet !p-3"
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="home-section-title">Your Profile</h2>
        <ArrowLink to="/profile">Edit profile</ArrowLink>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
        <MemberDuesStatus className="shrink-0 py-1 text-xs" />

        <dl className="grid grid-cols-1 gap-1.5 text-sm">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <dt className="w-12 shrink-0 text-[11px] font-normal tracking-[0.04em] text-gray-500">
              Email
            </dt>
            <dd className="min-w-0 truncate font-normal text-foreground">
              {member.email}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="w-12 shrink-0 text-[11px] font-normal tracking-[0.04em] text-gray-500">
              Major
            </dt>
            <dd className="font-normal text-foreground">{member.major}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="w-12 shrink-0 text-[11px] font-normal tracking-[0.04em] text-gray-500">
              Grad
            </dt>
            <dd className="font-normal tabular-nums text-foreground">
              {member.graduation_year}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="w-12 shrink-0 text-[11px] font-normal tracking-[0.04em] text-gray-500">
              Role
            </dt>
            <dd>
              <RoleBadge role={member.role} size="sm" />
            </dd>
          </div>
        </dl>
      </div>
    </HomeCard>
  );
}
