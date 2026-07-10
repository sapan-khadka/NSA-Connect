import type { LucideIcon } from "lucide-react";
import { AlertCircle, ListTodo } from "lucide-react";
import { Link } from "react-router-dom";

import { EventRsvpButton } from "../EventRsvpButton";
import { ArrowLink } from "../ui/ArrowLink";
import { EmptyState } from "../ui/EmptyState";
import { HomeCard } from "../ui/HomeCard";
import { SectionLabel } from "../ui/SectionLabel";
import type { MemberResponse } from "../../lib/auth-api";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../../lib/event-types";
import type { EventResponse, RsvpStatus } from "../../lib/events-api";
import { formatEventDateTime } from "../../lib/format-datetime";
import {
  RECENT_ACTIVITY_FOOTNOTE,
  type HomeActivity,
} from "../../lib/home-activities";
import { getTaskDisplayName, type MyTasksSummary } from "../../lib/home-tasks";
import { eventDetailPath } from "../../lib/event-links";
import type { MeetingSummary } from "../../lib/meetings-api";

const HOME_ACTIVITY_MAX_HEIGHT_CLASS = "max-h-64";

export function HomeWelcomeHeader({
  member,
  compact = false,
}: {
  member: MemberResponse;
  compact?: boolean;
}) {
  return (
    <div>
      <h1
        className={
          compact
            ? "text-xl font-light tracking-headline text-foreground"
            : "text-2xl font-light tracking-headline text-foreground md:text-3xl"
        }
      >
        Welcome back,{" "}
        <span className="text-foreground">{member.full_name}</span>
      </h1>
      {!compact ? (
        <p className="mt-1 text-sm text-label">
          Your daily check-in for NSA events and assigned work.
        </p>
      ) : null}
    </div>
  );
}

export function ActivityRow({
  activity,
  showDividerAbove = false,
}: {
  activity: HomeActivity;
  showDividerAbove?: boolean;
}) {
  const isRecent = activity.kind === "recent";
  const dotClass = isRecent
    ? "border border-gray-300 bg-transparent"
    : activity.tone === "urgent"
      ? "bg-overdue"
      : "bg-mint";

  return (
    <li className="list-none">
      {showDividerAbove ? (
        <div
          aria-hidden="true"
          className="mb-2 border-b border-dashed border-gray-200 sm:mb-3"
        />
      ) : null}
      <div className="flex flex-col gap-2 border-b border-gray-100 py-2.5 last:border-b-0 sm:flex-row sm:items-start sm:gap-3 sm:py-3">
        <span
          aria-hidden="true"
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`}
        />
        <div className="min-w-0 flex-1">
          <p
            className={
              !isRecent && activity.tone === "urgent"
                ? "text-sm font-medium text-foreground"
                : "text-sm text-foreground"
            }
          >
            {activity.message}
          </p>
          {isRecent ? (
            <p className="mt-1 text-xs text-label">{RECENT_ACTIVITY_FOOTNOTE}</p>
          ) : null}
        </div>
        <ArrowLink
          to={activity.to}
          className="shrink-0 self-start sm:whitespace-nowrap"
        >
          {activity.actionLabel}
        </ArrowLink>
      </div>
    </li>
  );
}

export function HomeActivitySection({
  activities,
  isLoading,
  tasksPath,
  truncatedFromTotal,
  scrollable = true,
}: {
  activities: HomeActivity[];
  isLoading: boolean;
  tasksPath: string;
  truncatedFromTotal?: number;
  scrollable?: boolean;
}) {
  const isTruncated =
    truncatedFromTotal !== undefined && truncatedFromTotal > activities.length;
  const firstRecentActivityIndex = activities.findIndex(
    (activity) => activity.kind === "recent",
  );

  return (
    <section aria-label="Activity" className="ds-card self-start p-3 lg:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="ds-section-label">Activity</h2>
        {isTruncated ? <ArrowLink to={tasksPath}>View all</ArrowLink> : null}
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-label lg:mt-4">Loading activity…</p>
      ) : null}

      {!isLoading && activities.length > 0 ? (
        <ul
          className={[
            "mt-2 lg:mt-3",
            scrollable
              ? "overflow-y-auto overscroll-y-contain lg:max-h-64"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {activities.map((activity, index) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              showDividerAbove={
                index === firstRecentActivityIndex &&
                firstRecentActivityIndex > 0
              }
            />
          ))}
        </ul>
      ) : null}

      {!isLoading && activities.length === 0 ? (
        <EmptyState
          icon="check"
          title="All caught up"
          description="Nothing needs your attention right now."
        />
      ) : null}
    </section>
  );
}

export function HomeYourWorkSection({
  member,
  tasksSummary,
  tasksPath,
  isLoading,
}: {
  member: MemberResponse;
  tasksSummary: MyTasksSummary;
  tasksPath: string;
  isLoading: boolean;
}) {
  return (
    <HomeCard padding="sm" className="self-start">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-medium text-foreground">
          {member.role === "general" ? "Assigned work" : "Your work"}
        </h2>
        <ArrowLink to={tasksPath}>View all</ArrowLink>
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-label lg:mt-4">Loading tasks…</p>
      ) : null}

      {!isLoading && tasksSummary.openCount === 0 ? (
        <EmptyState
          icon="check"
          title="No open tasks assigned"
          description="You're all caught up."
        />
      ) : null}

      {!isLoading && tasksSummary.openCount > 0 ? (
        <div className="mt-3 space-y-3 lg:mt-4 lg:space-y-4">
          <div className="grid grid-cols-2 gap-2 lg:gap-3">
            <div className="ds-stat-tile p-3 lg:p-4">
              <SectionLabel icon={ListTodo}>Open</SectionLabel>
              <p className="ds-stat-value">{tasksSummary.openCount}</p>
            </div>
            <div className="ds-stat-tile p-3 lg:p-4">
              <SectionLabel
                icon={AlertCircle}
                iconClassName={
                  tasksSummary.overdueCount > 0
                    ? "h-4 w-4 shrink-0 text-overdue"
                    : "h-4 w-4 shrink-0 text-label"
                }
                className={
                  tasksSummary.overdueCount > 0 ? "text-overdue" : undefined
                }
              >
                Overdue
              </SectionLabel>
              <p
                className={
                  tasksSummary.overdueCount > 0
                    ? "ds-stat-overdue-chip"
                    : "ds-stat-value"
                }
              >
                {tasksSummary.overdueCount}
              </p>
            </div>
          </div>

          {tasksSummary.nextTask ? (
            <p className="text-sm text-foreground">
              <span className="text-label">Next due: </span>
              {getTaskDisplayName(tasksSummary.nextTask)}
            </p>
          ) : null}
        </div>
      ) : null}
    </HomeCard>
  );
}

export function HomeUpNextSection({
  nextEvent,
  isLoading,
  rsvpLoading,
  onRsvpStatusChange,
}: {
  nextEvent: EventResponse | null;
  isLoading: boolean;
  rsvpLoading: boolean;
  onRsvpStatusChange: (status: RsvpStatus) => void;
}) {
  return (
    <HomeCard padding="sm" className="self-start">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-medium text-foreground">Up next</h2>
        <ArrowLink to="/events/calendar">Full calendar</ArrowLink>
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-label lg:mt-4">Loading events…</p>
      ) : null}

      {!isLoading && !nextEvent ? (
        <EmptyState
          icon="calendar"
          title="No upcoming events"
          description="Check the calendar for the next festival or social."
        />
      ) : null}

      {!isLoading && nextEvent ? (
        <div className="mt-3 space-y-3 lg:mt-4 lg:space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                to={eventDetailPath(nextEvent.id)}
                className="font-medium text-foreground hover:text-accent"
              >
                {nextEvent.name}
              </Link>
              <p className="mt-1 text-sm text-label">
                {formatEventDateTime(nextEvent.starts_at)}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[nextEvent.event_type]}`}
            >
              {EVENT_TYPE_LABELS[nextEvent.event_type]}
            </span>
          </div>

          <EventRsvpButton
            currentStatus={nextEvent.current_member_rsvp_status}
            canRsvp
            loading={rsvpLoading}
            embedded
            onStatusChange={onRsvpStatusChange}
          />
        </div>
      ) : null}
    </HomeCard>
  );
}

export function HomeBoardMeetingSection({
  meeting,
  attendeeSummary,
}: {
  meeting: MeetingSummary;
  attendeeSummary: string | null;
}) {
  return (
    <HomeCard padding="sm" className="self-start">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-medium text-foreground">
            Next board meeting
          </h2>
          <p className="mt-2 font-medium text-foreground">{meeting.event_name}</p>
          <p className="mt-1 text-sm text-label">
            {formatEventDateTime(meeting.starts_at)}
          </p>
          {attendeeSummary ? (
            <p className="mt-2 text-sm text-label lg:mt-3">{attendeeSummary}</p>
          ) : null}
        </div>
        <ArrowLink to={`/events/meetings/${meeting.event_id}`}>View</ArrowLink>
      </div>
    </HomeCard>
  );
}

export type QuickLink = {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
};

export function QuickLinkCard({ title, description, to, icon: Icon }: QuickLink) {
  return (
    <Link
      to={to}
      className="group flex h-full min-h-11 flex-col ds-card ds-card-interactive p-3 lg:p-[0.9rem]"
    >
      <Icon
        className="h-[18px] w-[18px] text-accent transition-colors group-hover:text-primary"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <p className="mt-2 text-[13px] font-medium text-foreground">{title}</p>
      <p className="mt-1 line-clamp-1 text-xs text-label">{description}</p>
    </Link>
  );
}

export { HOME_ACTIVITY_MAX_HEIGHT_CLASS };
