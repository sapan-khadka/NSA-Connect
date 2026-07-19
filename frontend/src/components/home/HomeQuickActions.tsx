import {
  CalendarPlus,
  ClipboardList,
  Megaphone,
  NotebookPen,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

import type { MemberResponse } from "../../lib/auth-api";
import {
  canManageTreasury,
  canViewMemberDirectory,
  isRoleAtLeast,
} from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";
import { HomeCard } from "../ui/HomeCard";

type QuickAction = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  toneClass: string;
};

export function HomeQuickActions({
  member,
  featuredEventId = null,
}: {
  member: MemberResponse;
  featuredEventId?: number | null;
}) {
  const isBoard = isRoleAtLeast(member.role, "board");
  const canInvite = canViewMemberDirectory(member.role);
  const canExpense = canManageTreasury(member.role, member.position);

  const actions: QuickAction[] = [];

  if (isBoard) {
    actions.push({
      id: "new-event",
      label: "New Event",
      to: "/events/calendar?create=1",
      icon: CalendarPlus,
      toneClass: "bg-emerald-50 text-emerald-700",
    });
  }

  actions.push({
    id: "new-task",
    label: "New Task",
    to: featuredEventId
      ? `/events/${featuredEventId}/manage`
      : "/events/tasks",
    icon: ClipboardList,
    toneClass: "bg-sky-50 text-sky-700",
  });

  if (isBoard) {
    actions.push({
      id: "announcement",
      label: "Announcement",
      to: "/announcements",
      icon: Megaphone,
      toneClass: "bg-violet-50 text-violet-700",
    });
    actions.push({
      id: "meeting-minutes",
      label: "Meeting Minutes",
      to: "/board/meeting-minutes",
      icon: NotebookPen,
      toneClass: "bg-amber-50 text-amber-800",
    });
  }

  if (canExpense) {
    actions.push({
      id: "record-expense",
      label: "Record Expense",
      to: "/finance?tab=transactions",
      icon: Wallet,
      toneClass: "bg-rose-50 text-rose-700",
    });
  }

  if (canInvite) {
    actions.push({
      id: "invite-member",
      label: "Invite Member",
      to: "/members",
      icon: UserPlus,
      toneClass: "bg-teal-50 text-teal-700",
    });
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <HomeCard
      padding="xs"
      className="home-surface-quiet"
      aria-label="Quick Actions"
    >
      <h2 className="home-section-title">Quick Actions</h2>
      <ul className="mt-2 grid grid-cols-3 gap-1.5">
        {actions.map((action) => (
          <li key={action.id}>
            <Link
              to={action.to}
              className="flex h-full flex-col items-center justify-center gap-1 rounded-lg border border-gray-100 bg-white px-1.5 py-2 text-center transition hover:border-gray-200 hover:shadow-sm"
            >
              <span
                className={[
                  "inline-flex h-7 w-7 items-center justify-center rounded-md",
                  action.toneClass,
                ].join(" ")}
              >
                <AppIcon icon={action.icon} size="xs" className="text-current" />
              </span>
              <span className="text-[10px] font-medium leading-snug text-foreground">
                {action.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}
