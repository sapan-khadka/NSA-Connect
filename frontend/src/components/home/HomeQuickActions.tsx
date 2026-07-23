import {
  CalendarDays,
  Megaphone,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

import type { MemberResponse } from "../../lib/auth-api";
import { FINANCE_BOOKS_PATH } from "../../lib/finance-routes";
import {
  canManageTreasury,
  canViewMemberDirectory,
  isRoleAtLeast,
} from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";
import { HomeCard } from "../ui/HomeCard";

type ActionTone = "teal" | "cyan" | "amber" | "violet";

type QuickAction = {
  id: string;
  label: string;
  ariaLabel: string;
  to: string;
  icon: typeof CalendarDays;
  tone: ActionTone;
};

export function HomeQuickActions({ member }: { member: MemberResponse }) {
  const actions: QuickAction[] = [];

  if (isRoleAtLeast(member.role, "board")) {
    actions.push({
      id: "create-event",
      label: "Event",
      ariaLabel: "Create Event",
      to: "/events/calendar?create=1",
      icon: CalendarDays,
      tone: "teal",
    });
  }

  if (canViewMemberDirectory(member.role)) {
    actions.push({
      id: "add-member",
      label: "Member",
      ariaLabel: "Add Member",
      to: "/members?tab=pending",
      icon: UserPlus,
      tone: "cyan",
    });
  }

  if (isRoleAtLeast(member.role, "board")) {
    actions.push({
      id: "announcement",
      label: "Announce",
      ariaLabel: "Post Announcement",
      to: "/announcements",
      icon: Megaphone,
      tone: "amber",
    });
  }

  if (canManageTreasury(member.role, member.position)) {
    actions.push({
      id: "add-expense",
      label: "Expense",
      ariaLabel: "Add Expense",
      to: FINANCE_BOOKS_PATH,
      icon: Wallet,
      tone: "violet",
    });
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <HomeCard
      padding="sm"
      className="home-surface-quiet home-quick-actions-card"
      aria-label="Quick actions"
    >
      <div className="home-task-header">
        <h2 className="home-panel-title">Quick actions</h2>
      </div>
      <ul className="home-quick-actions-tiles">
        {actions.map((action) => (
          <li key={action.id}>
            <Link
              to={action.to}
              aria-label={action.ariaLabel}
              className={[
                "home-quick-action-tile",
                `home-quick-action-tile--${action.tone}`,
              ].join(" ")}
            >
              <span className="home-quick-action-tile-icon" aria-hidden="true">
                <AppIcon icon={action.icon} size="md" className="text-current" />
              </span>
              <span className="home-quick-action-tile-label">{action.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}
