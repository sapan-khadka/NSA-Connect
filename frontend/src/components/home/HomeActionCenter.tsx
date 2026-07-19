import {
  CalendarPlus,
  ClipboardList,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

import type { MemberResponse } from "../../lib/auth-api";
import { FINANCE_APPROVALS_PATH } from "../../lib/finance-routes";
import {
  canManageTreasury,
  canViewMemberDirectory,
  isRoleAtLeast,
} from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

type QuickAction = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
};

export function HomeActionCenter({
  member,
  featuredEventId = null,
  pendingMemberApprovals = 0,
  financePendingCount = 0,
  showAssistant = false,
}: {
  member: MemberResponse;
  featuredEventId?: number | null;
  pendingMemberApprovals?: number;
  financePendingCount?: number;
  showAssistant?: boolean;
}) {
  const isBoard = isRoleAtLeast(member.role, "board");
  const canInvite = canViewMemberDirectory(member.role);
  const canExpense = canManageTreasury(member.role, member.position);

  const reviews: Array<{ id: string; label: string; to: string }> = [];
  if (canInvite && pendingMemberApprovals > 0) {
    reviews.push({
      id: "member-approvals",
      label: `${pendingMemberApprovals} member approval${pendingMemberApprovals === 1 ? "" : "s"} pending`,
      to: "/members?tab=pending",
    });
  }
  if (canExpense && financePendingCount > 0) {
    reviews.push({
      id: "finance-approvals",
      label: `${financePendingCount} finance review${financePendingCount === 1 ? "" : "s"} required`,
      to: FINANCE_APPROVALS_PATH,
    });
  }

  const actions: QuickAction[] = [];
  if (isBoard) {
    actions.push({
      id: "new-event",
      label: "New Event",
      to: "/events/calendar?create=1",
      icon: CalendarPlus,
    });
  }
  actions.push({
    id: "new-task",
    label: "New Task",
    to: featuredEventId
      ? `/events/${featuredEventId}/manage`
      : "/events/tasks",
    icon: ClipboardList,
  });
  if (canInvite && actions.length < 3) {
    actions.push({
      id: "invite-member",
      label: "Invite",
      to: "/members",
      icon: UserPlus,
    });
  }

  if (actions.length === 0 && reviews.length === 0 && !showAssistant) {
    return null;
  }

  return (
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet"
      aria-label="Action Center"
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="home-section-title">Do next</h2>
        {showAssistant ? (
          <ArrowLink to="/assistant">Ask AI</ArrowLink>
        ) : null}
      </div>

      {reviews.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {reviews.map((item) => (
            <li key={item.id}>
              <Link
                to={item.to}
                className="block rounded-xl bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-950 transition hover:bg-amber-50"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          {isBoard ? "Create or assign the next piece of work." : "Start a task when you’re ready."}
        </p>
      )}

      {actions.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {actions.map((action) => (
            <li key={action.id}>
              <Link
                to={action.to}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <AppIcon
                    icon={action.icon}
                    size="xs"
                    className="text-current"
                  />
                </span>
                {action.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </HomeCard>
  );
}
