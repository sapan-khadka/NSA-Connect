/**
 * Upcoming Schedule — chronological commitments for the Member Workspace.
 */

import { CalendarDays, HandHelping, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";

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
  return <p className="member-workspace-empty-inline">No schedule.</p>;
}

function ScheduleRow({ item }: { item: ScheduleCommitment }) {
  return (
    <li>
      <Link
        to={item.href}
        className="member-workspace-resp-item member-workspace-schedule-item"
        aria-label={`Open ${item.title}`}
      >
        <span className="member-workspace-schedule-icon" aria-hidden="true">
          <AppIcon
            icon={KIND_ICONS[item.kind]}
            size="xs"
            className="text-current"
          />
        </span>
        <div className="member-workspace-schedule-copy">
          <p className="member-workspace-resp-title">{item.title}</p>
          {item.detail ? (
            <p className="member-workspace-resp-event">{item.detail}</p>
          ) : null}
          <p className="member-workspace-schedule-when">{item.whenLabel}</p>
        </div>
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
          </div>
        </div>
        {hasMore ? (
          <Link
            to={viewAllPath}
            className="ds-view-all member-workspace-resp-view-all"
          >
            View all
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
