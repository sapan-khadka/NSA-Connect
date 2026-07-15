/**
 * Upcoming Schedule — chronological commitments for the Member Workspace.
 */

import { CalendarDays, HandHelping, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type {
  ScheduleCommitment,
  ScheduleCommitmentKind,
} from "../../lib/member-workspace-schedule";
import { SCHEDULE_VIEW_ALL_PATH } from "../../lib/member-workspace-schedule";
import { AppIcon } from "../ui/AppIcon";

const KIND_ICONS: Record<ScheduleCommitmentKind, LucideIcon> = {
  event: CalendarDays,
  volunteer: HandHelping,
  meeting: Users,
};

type MemberWorkspaceUpcomingScheduleProps = {
  items: ScheduleCommitment[];
  hasMore: boolean;
  isLoading?: boolean;
  viewAllPath?: string;
};

function ScheduleEmpty() {
  return (
    <div className="member-workspace-resp-empty">
      <div className="member-workspace-resp-empty-art" aria-hidden="true">
        <svg
          viewBox="0 0 120 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="member-workspace-resp-empty-svg"
        >
          <rect
            x="28"
            y="18"
            width="64"
            height="48"
            rx="10"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.35"
          />
          <path
            d="M28 34h64M48 18v10M72 18v10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.28"
          />
          <circle cx="52" cy="48" r="3" fill="currentColor" opacity="0.28" />
          <circle cx="68" cy="48" r="3" fill="currentColor" opacity="0.18" />
        </svg>
      </div>
      <p className="member-workspace-resp-empty-title">
        Nothing on the schedule yet.
      </p>
    </div>
  );
}

function ScheduleRow({ item }: { item: ScheduleCommitment }) {
  return (
    <li>
      <Link
        to={item.href}
        className="member-workspace-resp-item member-workspace-schedule-item"
        aria-label={`Open ${item.title}`}
      >
        <div className="member-workspace-schedule-item-main">
          <span
            className={`member-workspace-schedule-kind member-workspace-schedule-kind--${item.kind}`}
          >
            <AppIcon
              icon={KIND_ICONS[item.kind]}
              size="xs"
              className="text-current"
            />
            <span>{item.kindLabel}</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="member-workspace-resp-title">{item.title}</p>
            {item.detail ? (
              <p className="member-workspace-resp-event">{item.detail}</p>
            ) : null}
          </div>
        </div>
        <p className="member-workspace-schedule-when">{item.whenLabel}</p>
      </Link>
    </li>
  );
}

export function MemberWorkspaceUpcomingSchedule({
  items,
  hasMore,
  isLoading = false,
  viewAllPath = SCHEDULE_VIEW_ALL_PATH,
}: MemberWorkspaceUpcomingScheduleProps) {
  return (
    <section
      className="member-workspace-card member-workspace-card--default member-workspace-schedule"
      aria-label="Upcoming Schedule"
    >
      <div className="member-workspace-card-header member-workspace-resp-header">
        <div className="member-workspace-card-heading">
          <span className="member-workspace-card-icon" aria-hidden="true">
            <AppIcon icon={CalendarDays} size="sm" className="text-current" />
          </span>
          <div className="min-w-0">
            <h2 className="member-workspace-card-title">Upcoming Schedule</h2>
            <p className="member-workspace-card-desc">
              What this member is committed to next.
            </p>
          </div>
        </div>
        {hasMore ? (
          <Link to={viewAllPath} className="member-workspace-resp-view-all">
            View all
            <span aria-hidden="true"> →</span>
          </Link>
        ) : null}
      </div>

      <div className="member-workspace-card-body member-workspace-resp-body">
        {isLoading ? (
          <p className="member-workspace-resp-loading">Loading schedule…</p>
        ) : null}

        {!isLoading && items.length === 0 ? <ScheduleEmpty /> : null}

        {!isLoading && items.length > 0 ? (
          <ul className="member-workspace-resp-list">
            {items.map((item) => (
              <ScheduleRow key={item.id} item={item} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
