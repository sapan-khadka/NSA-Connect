import {
  AlertTriangle,
  ClipboardCheck,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import type { MemberResponse } from "../../lib/auth-api";
import { FINANCE_APPROVALS_PATH } from "../../lib/finance-routes";
import type { NotificationSummary } from "../../lib/notifications-api";
import {
  canManageTreasury,
  canViewMemberDirectory,
  isRoleAtLeast,
} from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";

type AttentionChip = {
  id: string;
  label: string;
  shortLabel: string;
  count: number;
  to: string;
  icon: typeof AlertTriangle;
  tone: "overdue" | "amber" | "sky" | "violet";
};

export function HomeAttentionStrip({
  member,
  summary,
}: {
  member: MemberResponse;
  summary: NotificationSummary;
}) {
  const canReviewMembers = canViewMemberDirectory(member.role);
  const canReviewFinance = canManageTreasury(member.role, member.position);
  const pendingApprovals =
    (canReviewMembers ? summary.members_pending : 0) +
    (canReviewFinance ? summary.finance_pending : 0);
  const showBoardChips = isRoleAtLeast(member.role, "board");

  const chips: AttentionChip[] = [
    {
      id: "overdue-tasks",
      label: "Overdue tasks",
      shortLabel: "Overdue",
      count: summary.tasks_overdue,
      to: "/events/tasks",
      icon: AlertTriangle,
      tone: "overdue",
    },
    {
      id: "pending-approvals",
      label: "Pending approvals",
      shortLabel: "Approvals",
      count: pendingApprovals,
      to:
        canReviewMembers && summary.members_pending > 0
          ? "/members?tab=pending"
          : canReviewFinance
            ? FINANCE_APPROVALS_PATH
            : "/notifications",
      icon: ClipboardCheck,
      tone: "amber",
    },
  ];

  if (showBoardChips) {
    chips.push(
      {
        id: "event-needs-update",
        label: "Event needs update",
        shortLabel: "Events",
        count: summary.suggestions_pending,
        to: "/events/calendar",
        icon: Sparkles,
        tone: "sky",
      },
      {
        id: "notes-response",
        label: "Notes needing response",
        shortLabel: "Notes",
        count: summary.discussions_unread,
        to: "/discussions",
        icon: MessageSquareText,
        tone: "violet",
      },
    );
  }

  return (
    <section
      className="home-attention-strip"
      aria-label="Needs your attention"
    >
      <div className="home-attention-strip-inner">
        <p className="home-attention-strip-label">Needs your attention</p>
        <ul className="home-attention-chips">
          {chips.map((chip) => (
            <li key={chip.id}>
              <Link
                to={chip.to}
                aria-label={`${chip.count} ${chip.label}`}
                className={[
                  "home-attention-chip",
                  `home-attention-chip--${chip.tone}`,
                  chip.count === 0 ? "is-muted" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <AppIcon icon={chip.icon} size="xs" className="text-current" />
                <span className="home-attention-chip-count">{chip.count}</span>
                <span className="home-attention-chip-label">{chip.label}</span>
                <span className="home-attention-chip-label-short">
                  {chip.shortLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/notifications" className="home-attention-view-all">
          View all
        </Link>
      </div>
    </section>
  );
}
