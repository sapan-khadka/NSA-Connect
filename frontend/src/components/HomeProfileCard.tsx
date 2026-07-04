import { RoleBadge } from "./RoleBadge";
import { ArrowLink } from "./ui/ArrowLink";
import { HomeCard } from "./ui/HomeCard";
import type { MemberResponse } from "../lib/auth-api";

type HomeProfileCardProps = {
  member: MemberResponse;
};

export function HomeProfileCard({ member }: HomeProfileCardProps) {
  return (
    <HomeCard className="self-start">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-light tracking-subhead text-foreground">Your profile</h2>
        <ArrowLink to="/profile">Edit profile</ArrowLink>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-label">Email</dt>
          <dd className="font-medium text-foreground">{member.email}</dd>
        </div>
        <div>
          <dt className="text-label">Major</dt>
          <dd className="font-medium text-foreground">{member.major}</dd>
        </div>
        <div>
          <dt className="text-label">Graduation</dt>
          <dd className="font-medium text-foreground">{member.graduation_year}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-label">Role</dt>
          <dd>
            <RoleBadge role={member.role} size="md" />
          </dd>
        </div>
      </dl>
    </HomeCard>
  );
}
