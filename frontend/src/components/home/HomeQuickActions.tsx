import {
  CalendarDays,
  ClipboardList,
  FileText,
  Megaphone,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

import type { MemberResponse } from "../../lib/auth-api";
import { FINANCE_BOOKS_PATH } from "../../lib/finance-routes";
import {
  canManageEventTasks,
  canManageTreasury,
  canViewMemberDirectory,
  isRoleAtLeast,
} from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";

type ActionTone = "teal" | "slate" | "amber" | "olive" | "sky" | "gray";

type QuickAction = {
  id: string;
  label: string;
  to: string;
  icon: typeof ClipboardList;
  tone: ActionTone;
};

export function HomeQuickActions({ member }: { member: MemberResponse }) {
  const actions: QuickAction[] = [];

  if (canManageEventTasks(member.role, member.position)) {
    actions.push({
      id: "add-task",
      label: "Add Task",
      to: "/events/tasks",
      icon: ClipboardList,
      tone: "teal",
    });
  } else {
    actions.push({
      id: "my-tasks",
      label: "My Tasks",
      to: "/events/tasks",
      icon: ClipboardList,
      tone: "teal",
    });
  }

  if (isRoleAtLeast(member.role, "board")) {
    actions.push({
      id: "create-event",
      label: "Create Event",
      to: "/events/calendar?create=1",
      icon: CalendarDays,
      tone: "slate",
    });
    actions.push({
      id: "announcement",
      label: "Send Announcement",
      to: "/announcements",
      icon: Megaphone,
      tone: "amber",
    });
  }

  if (canViewMemberDirectory(member.role)) {
    actions.push({
      id: "add-member",
      label: "Add Member",
      to: "/members?tab=pending",
      icon: UserPlus,
      tone: "olive",
    });
  }

  if (canManageTreasury(member.role, member.position)) {
    actions.push({
      id: "add-expense",
      label: "Add Expense",
      to: FINANCE_BOOKS_PATH,
      icon: Wallet,
      tone: "sky",
    });
  }

  actions.push({
    id: "reports",
    label: "View Reports",
    to: "/reports",
    icon: FileText,
    tone: "gray",
  });

  return (
    <section aria-label="Quick actions" className="home-quick-actions">
      <ul className="home-quick-actions-list">
        {actions.map((action) => (
          <li key={action.id}>
            <Link
              to={action.to}
              className={[
                "home-quick-action",
                `home-quick-action--${action.tone}`,
              ].join(" ")}
            >
              <span className="home-quick-action-icon" aria-hidden="true">
                <AppIcon icon={action.icon} size="sm" className="text-current" />
              </span>
              <span className="home-quick-action-label">{action.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
