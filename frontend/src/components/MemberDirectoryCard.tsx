import { Link } from "react-router-dom";

import type { MemberResponse } from "../lib/auth-api";
import {
  buildMemberContactLine,
  formatTalentLabel,
  getMemberInitials,
} from "../lib/member-talents";

type MemberDirectoryCardProps = {
  member: MemberResponse;
  to: string;
};

export function MemberDirectoryCard({ member, to }: MemberDirectoryCardProps) {
  const contactLine = buildMemberContactLine(member);
  const talents = member.talents ?? [];

  return (
    <Link
      to={to}
      className="group block bg-white px-4 py-4 lg:rounded-2xl lg:border lg:border-[#E7EBF1] lg:p-5 lg:shadow-[0_1px_3px_rgba(0,0,0,0.05),0_8px_20px_rgba(0,0,0,0.04)] lg:transition-all lg:hover:-translate-y-0.5 lg:hover:shadow-[0_2px_6px_rgba(0,0,0,0.08),0_12px_28px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#E7EBF1] bg-[#FAFAF9] text-sm font-medium text-foreground">
          {getMemberInitials(member.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-medium text-foreground group-hover:text-accent">
            {member.full_name}
          </h3>
          <p className="mt-1 text-sm text-label">
            {member.major} · {member.graduation_year}
          </p>
          {talents.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {talents.map((talent) => (
                <li
                  key={talent}
                  className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-xs text-label"
                >
                  {formatTalentLabel(talent, member.talent_other)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-label">No talents listed</p>
          )}
          {contactLine ? (
            <p className="mt-3 truncate text-sm text-foreground">{contactLine}</p>
          ) : (
            <p className="mt-3 text-sm text-label">Contact info private</p>
          )}
        </div>
      </div>
    </Link>
  );
}
