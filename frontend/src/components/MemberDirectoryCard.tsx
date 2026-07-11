import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { MemberResponse } from "../lib/auth-api";
import {
  formatTalentLabel,
  getMemberInitials,
} from "../lib/member-talents";
import { AppIcon } from "./ui/AppIcon";

type MemberDirectoryRowProps = {
  member: MemberResponse;
  to: string;
};

export function MemberDirectoryRow({ member, to }: MemberDirectoryRowProps) {
  const talents = member.talents ?? [];
  const majorYear = `${member.major} · ${member.graduation_year}`;
  const email = member.email?.trim() || null;

  return (
    <Link
      to={to}
      className="group grid grid-cols-1 gap-2 px-4 py-3 transition-colors hover:bg-gray-50 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4 lg:px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-foreground">
          {getMemberInitials(member.full_name)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground group-hover:text-primary">
            {member.full_name}
          </p>
          <p className="truncate text-sm text-gray-500 sm:hidden">{majorYear}</p>
        </div>
      </div>

      <p className="hidden truncate text-sm text-gray-500 sm:block">{majorYear}</p>

      <div className="min-w-0 pl-11 sm:pl-0">
        {talents.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {talents.map((talent) => (
              <li
                key={talent}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
              >
                {formatTalentLabel(talent, member.talent_other)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No talents listed</p>
        )}
      </div>

      <p className="truncate pl-11 text-sm text-gray-600 sm:pl-0 sm:text-right">
        {email ?? "Email private"}
      </p>

      <span className="hidden items-center justify-end text-gray-400 sm:flex">
        <AppIcon
          icon={ChevronRight}
          size="sm"
          className="text-gray-400 transition-colors group-hover:text-gray-600"
        />
        <span className="sr-only">View profile</span>
      </span>
    </Link>
  );
}

/** @deprecated Use MemberDirectoryRow */
export const MemberDirectoryCard = MemberDirectoryRow;
