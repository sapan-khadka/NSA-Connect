/**
 * Outstanding dues follow-ups for Members → Needs attention (treasury).
 */

import { BadgeDollarSign } from "lucide-react";
import { Link } from "react-router-dom";

import { Avatar } from "../design-system/components/Avatar";
import type { MemberResponse } from "../lib/auth-api";
import { formatCurrency } from "../lib/format-currency";
import {
  formatOutstandingDuesCell,
  type MemberDuesLookup,
} from "../lib/members-directory";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

type MembersDuesFollowUpsProps = {
  members: MemberResponse[];
  duesByMemberId: MemberDuesLookup;
  onReviewInDirectory: () => void;
};

export function listOutstandingDuesMembers(
  members: MemberResponse[],
  duesByMemberId: MemberDuesLookup,
): Array<{ member: MemberResponse; amountLabel: string }> {
  const rows: Array<{ member: MemberResponse; amountLabel: string }> = [];

  for (const member of members) {
    if (member.status !== "approved") {
      continue;
    }
    const record = duesByMemberId.get(member.id);
    if (!record || (record.status !== "unpaid" && record.status !== "partial")) {
      continue;
    }
    const outstanding = formatOutstandingDuesCell(record);
    rows.push({
      member,
      amountLabel:
        outstanding !== null ? formatCurrency(outstanding) : formatCurrency(0),
    });
  }

  rows.sort((left, right) =>
    left.member.full_name.localeCompare(right.member.full_name, undefined, {
      sensitivity: "base",
    }),
  );

  return rows;
}

export function MembersDuesFollowUps({
  members,
  duesByMemberId,
  onReviewInDirectory,
}: MembersDuesFollowUpsProps) {
  const allRows = listOutstandingDuesMembers(members, duesByMemberId);
  const rows = allRows.slice(0, 6);
  const totalOutstanding = allRows.length;

  if (totalOutstanding === 0) {
    return null;
  }

  return (
    <section
      aria-label="Outstanding dues"
      className="overflow-hidden rounded-2xl border border-gray-200 bg-surface-card"
    >
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            Outstanding dues
          </h2>
          <p className="mt-0.5 text-xs text-label sm:text-sm">
            {totalOutstanding} member
            {totalOutstanding === 1 ? "" : "s"} with unpaid balances this
            semester.
          </p>
        </div>
        <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-badge-teal-bg px-2.5 text-xs font-semibold tabular-nums text-primary">
          <AppIcon icon={BadgeDollarSign} size="xs" className="text-current" />
          {totalOutstanding}
        </span>
      </div>

      <ul className="divide-y divide-gray-100">
        {rows.map(({ member, amountLabel }) => (
          <li key={member.id}>
            <Link
              to={`/members/${member.id}`}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted/50 sm:px-5"
            >
              <Avatar name={member.full_name} size="sm" className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {member.full_name}
                </span>
                <span className="block truncate text-xs text-label">
                  {member.email}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-overdue">
                {amountLabel}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="border-t border-gray-100 px-4 py-3 sm:px-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReviewInDirectory}
        >
          Review in People directory
        </Button>
      </div>
    </section>
  );
}
