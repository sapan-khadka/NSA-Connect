import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ListTodo,
  Megaphone,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

import type { MemberResponse } from "../../lib/auth-api";
import type { BadgeCategory } from "../../lib/badge-tones";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../../lib/event-types";
import type { EventResponse, RsvpStatus } from "../../lib/events-api";
import { eventDetailPath } from "../../lib/event-links";
import { formatEventDateTime } from "../../lib/format-datetime";
import { formatCurrency } from "../../lib/format-currency";
import { FINANCE_APPROVALS_PATH } from "../../lib/finance-routes";
import {
  RECENT_ACTIVITY_FOOTNOTE,
  type HomeActivity,
} from "../../lib/home-activities";
import { getTaskDisplayName, type MyTasksSummary } from "../../lib/home-tasks";
import type { MeetingSummary } from "../../lib/meetings-api";
import { EventRsvpButton } from "../EventRsvpButton";
import { AppIcon } from "../ui/AppIcon";
import { ArrowLink } from "../ui/ArrowLink";
import { EmptyState } from "../ui/EmptyState";
import { HomeCard } from "../ui/HomeCard";
import { IconBadge } from "../ui/IconBadge";
import nsaCover from "../../assets/nsa-cover.PNG";

const HOME_ACTIVITY_MAX_HEIGHT_CLASS = "max-h-72";

const ACTIVITY_ICON: Record<
  string,
  { icon: LucideIcon; category: BadgeCategory }
> = {
  "overdue-tasks": { icon: AlertCircle, category: "urgent" },
  "pending-members": { icon: Users, category: "members" },
  "finance-pending": { icon: Wallet, category: "finance" },
  "finance-rejected": { icon: AlertCircle, category: "warning" },
  "finance-approved": { icon: CheckCircle2, category: "tasks" },
};

function activityVisual(activity: HomeActivity): {
  icon: LucideIcon;
  category: BadgeCategory;
} {
  return (
    ACTIVITY_ICON[activity.id] ?? {
      icon: activity.tone === "urgent" ? AlertCircle : Megaphone,
      category: activity.tone === "urgent" ? "urgent" : "announcements",
    }
  );
}

export function HomeWelcomeBanner({
  member,
  showLogTransaction,
  onLogTransaction,
  pendingApprovalCount = 0,
}: {
  member: MemberResponse;
  showLogTransaction: boolean;
  onLogTransaction: () => void;
  pendingApprovalCount?: number;
}) {
  return (
    <section
      className="relative h-[200px] overflow-hidden rounded-card"
      aria-label="Welcome"
    >
      <img
        src={nsaCover}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/55"
      />
      <div className="relative flex h-full flex-col justify-center gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="min-w-0 text-white">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-white">
            Welcome back, {member.full_name}{" "}
            <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80">
            Here&apos;s what&apos;s happening with your organization today.
          </p>
        </div>

        {showLogTransaction ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onLogTransaction}
              className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-white/90"
            >
              Log Transaction
            </button>
            <Link
              to={FINANCE_APPROVALS_PATH}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/35 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
            >
              Review Approvals
              {pendingApprovalCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold text-foreground">
                  {pendingApprovalCount}
                </span>
              ) : null}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** @deprecated Prefer HomeWelcomeBanner */
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
            ? "text-lg font-semibold tracking-tight text-foreground"
            : "text-[32px] font-bold tracking-tight text-foreground"
        }
      >
        Welcome back,{" "}
        <span className="text-foreground">{member.full_name}</span>
      </h1>
      {!compact ? (
        <p className="mt-2 text-sm text-label">
          Your daily check-in for NSA events and assigned work.
        </p>
      ) : null}
    </div>
  );
}

export type HomeStatCardsProps = {
  tasksSummary: MyTasksSummary;
  upcomingCount: number;
  nextEvent: EventResponse | null;
  memberCount: number | null;
  budgetBalance: string | null;
  tasksPath: string;
  canViewMembers: boolean;
  canViewFinance: boolean;
  isLoading: boolean;
};

export function HomeStatCards({
  tasksSummary,
  upcomingCount,
  nextEvent,
  memberCount,
  budgetBalance,
  tasksPath,
  canViewMembers,
  canViewFinance,
  isLoading,
}: HomeStatCardsProps) {
  const nextLabel = nextEvent
    ? `Next: ${nextEvent.name} ${formatEventDateTime(nextEvent.starts_at)}`
    : "No upcoming events";

  const cards = [
    {
      key: "tasks",
      label: "Open Tasks",
      value: isLoading ? "—" : String(tasksSummary.openCount),
      hint:
        tasksSummary.overdueCount > 0
          ? `${tasksSummary.overdueCount} overdue`
          : "Assigned work still open",
      hintUrgent: tasksSummary.overdueCount > 0,
      icon: ListTodo,
      category: "tasks" as const,
      to: tasksPath,
    },
    {
      key: "events",
      label: "Upcoming Events",
      value: isLoading ? "—" : String(upcomingCount),
      hint: nextLabel,
      hintUrgent: false,
      icon: CalendarDays,
      category: "events" as const,
      to: "/events/calendar",
    },
    {
      key: "members",
      label: "Members",
      value:
        isLoading || !canViewMembers || memberCount === null
          ? "—"
          : String(memberCount),
      hint: canViewMembers ? "Active members" : "Directory access required",
      hintUrgent: false,
      icon: Users,
      category: "members" as const,
      to: canViewMembers ? "/members" : null,
    },
    {
      key: "budget",
      label: "Budget Balance",
      value:
        isLoading || !canViewFinance || budgetBalance === null
          ? "—"
          : formatCurrency(budgetBalance),
      hint: canViewFinance ? "Net treasury balance" : "Finance access required",
      hintUrgent: false,
      icon: Wallet,
      category: "finance" as const,
      to: canViewFinance ? "/finance" : null,
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const content = (
          <>
            <IconBadge
              icon={card.icon}
              category={card.category}
              size="lg"
              shape="rounded"
            />
            <p className="mt-4 text-sm font-semibold text-label">
              {card.label}
            </p>
            <p className="mt-2 text-[32px] font-bold leading-none tracking-tight text-foreground">
              {card.value}
            </p>
            <p
              className={[
                "mt-2 line-clamp-2 text-sm",
                card.hintUrgent ? "font-medium text-overdue" : "text-label",
              ].join(" ")}
            >
              {card.hint}
            </p>
          </>
        );

        const className =
          "group flex h-full flex-col rounded-card border border-gray-200 bg-white p-4 shadow-card transition duration-200 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-card-hover";

        return (
          <li key={card.key} className="min-w-0">
            {card.to ? (
              <Link to={card.to} className={className}>
                {content}
              </Link>
            ) : (
              <div className={className}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function activityTitle(activity: HomeActivity): string {
  switch (activity.id) {
    case "overdue-tasks":
      return "Task Assigned";
    case "pending-members":
      return "Member Joined";
    case "finance-pending":
    case "finance-my-pending":
      return "Expense Review";
    case "finance-my-approved":
      return "Expense Approved";
    case "finance-my-rejected":
      return "Expense Rejected";
    default:
      if (activity.id.includes("announcement")) {
        return "Announcement Posted";
      }
      if (activity.id.includes("member")) {
        return "Member Joined";
      }
      if (activity.id.includes("task")) {
        return "Task Assigned";
      }
      if (activity.id.includes("finance")) {
        return "Expense Approved";
      }
      return "Update";
  }
}

export function ActivityRow({
  activity,
  isLast = false,
}: {
  activity: HomeActivity;
  isLast?: boolean;
}) {
  const isRecent = activity.kind === "recent";
  const visual = activityVisual(activity);
  const title = activityTitle(activity);

  return (
    <li className="relative list-none pl-0">
      <div className="flex gap-4">
        <div className="relative flex w-8 shrink-0 flex-col items-center">
          <IconBadge
            icon={visual.icon}
            category={visual.category}
            size="sm"
            shape="rounded"
          />
          {!isLast ? (
            <span
              aria-hidden="true"
              className="mt-2 w-px flex-1 bg-gray-200"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 pb-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <ArrowLink
              to={activity.to}
              className="shrink-0 !min-h-0 py-0 text-sm sm:whitespace-nowrap"
            >
              {activity.actionLabel}
            </ArrowLink>
          </div>
          <p
            className={[
              "mt-1 text-sm",
              !isRecent && activity.tone === "urgent"
                ? "font-medium text-foreground"
                : "text-label",
            ].join(" ")}
          >
            {activity.message}
          </p>
          {isRecent ? (
            <p className="mt-1 text-sm text-label">{RECENT_ACTIVITY_FOOTNOTE}</p>
          ) : null}
        </div>
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

  return (
    <HomeCard className="flex h-full min-h-[28rem] flex-col" aria-label="Activity">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div className="ds-icon-label">
          <IconBadge icon={ListTodo} category="tasks" size="sm" />
          <h2 className="text-lg font-semibold text-foreground">Activity</h2>
        </div>
        {isTruncated ? <ArrowLink to={tasksPath}>View all</ArrowLink> : null}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <p className="text-sm text-label">Loading activity…</p>
        ) : null}

        {!isLoading && activities.length === 0 ? (
          <EmptyState
            icon="check"
            title="You're all caught up"
            description="No action items right now — check back after the next event."
          />
        ) : null}

        {!isLoading && activities.length > 0 ? (
          <ul
            className={[
              "min-h-0 flex-1",
              scrollable ? "overflow-y-auto pr-1" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {activities.map((activity, index) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                isLast={index === activities.length - 1}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </HomeCard>
  );
}

export function HomeYourWorkSection({
  member: _member,
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
    <HomeCard className="flex h-full min-h-[28rem] flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div className="ds-icon-label">
          <IconBadge icon={ClipboardList} category="tasks" size="sm" />
          <h2 className="text-lg font-semibold text-foreground">Your Work</h2>
        </div>
        <ArrowLink to={tasksPath}>View all</ArrowLink>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <p className="text-sm text-label">Loading tasks…</p>
        ) : null}

        {!isLoading ? (
          <div className="flex flex-1 flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-card border border-gray-200 bg-success-surface p-4">
                <p className="text-sm font-semibold text-success">
                  Open Tasks
                </p>
                <p className="mt-2 text-[32px] font-bold leading-none tracking-tight text-foreground">
                  {tasksSummary.openCount}
                </p>
              </div>
              <div
                className={
                  tasksSummary.overdueCount > 0
                    ? "rounded-card border border-overdue/20 bg-overdue-surface p-4"
                    : "rounded-card border border-gray-200 bg-surface-muted p-4"
                }
              >
                <p
                  className={
                    tasksSummary.overdueCount > 0
                      ? "text-sm font-semibold text-overdue"
                      : "text-sm font-semibold text-label"
                  }
                >
                  Overdue
                </p>
                <p
                  className={
                    tasksSummary.overdueCount > 0
                      ? "mt-2 text-[32px] font-bold leading-none tracking-tight text-overdue"
                      : "mt-2 text-[32px] font-bold leading-none tracking-tight text-foreground"
                  }
                >
                  {tasksSummary.overdueCount}
                </p>
              </div>
            </div>

            <div className="mt-auto rounded-card border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-label">
                Next Due
              </p>
              {tasksSummary.nextTask ? (
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {getTaskDisplayName(tasksSummary.nextTask)}
                </p>
              ) : (
                <p className="mt-2 text-sm text-label">No upcoming due dates</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
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
  if (isLoading) {
    return (
      <HomeCard className="w-full">
        <div className="ds-icon-label">
          <IconBadge icon={CalendarDays} category="events" size="sm" />
          <h2 className="text-lg font-semibold text-foreground">
            Upcoming Event
          </h2>
        </div>
        <p className="mt-4 text-sm text-label">Loading events…</p>
      </HomeCard>
    );
  }

  if (!nextEvent) {
    return (
      <HomeCard className="w-full">
        <div className="flex items-center justify-between gap-4">
          <div className="ds-icon-label">
            <IconBadge icon={CalendarDays} category="events" size="sm" />
            <h2 className="text-lg font-semibold text-foreground">
              Upcoming Event
            </h2>
          </div>
          <Link
            to="/events/calendar"
            className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-foreground transition duration-200 hover:border-primary/40 hover:bg-badge-teal-bg"
          >
            View Calendar
          </Link>
        </div>
        <EmptyState
          icon="calendar"
          title="No upcoming events"
          description="Check the calendar for the next festival or social."
        />
      </HomeCard>
    );
  }

  return (
    <section className="w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-card transition duration-200 ease-out hover:shadow-card-hover">
      <div className="flex flex-col lg:flex-row">
        {/* Left — invitation image */}
        <div className="relative h-48 w-full shrink-0 overflow-hidden lg:h-auto lg:min-h-[240px] lg:w-[280px] xl:w-[320px]">
          <img
            src={nsaCover}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-black/10"
          />
          <span
            className={`absolute left-4 top-4 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${EVENT_TYPE_BADGE_CLASS[nextEvent.event_type]}`}
          >
            {EVENT_TYPE_LABELS[nextEvent.event_type]}
          </span>
        </div>

        {/* Middle — event details + RSVP */}
        <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:p-6">
          <p className="text-sm font-semibold text-label">
            You&apos;re invited
          </p>
          <Link
            to={eventDetailPath(nextEvent.id)}
            className="mt-2 text-lg font-semibold tracking-tight text-foreground hover:text-primary"
          >
            {nextEvent.name}
          </Link>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-label">Date</dt>
              <dd className="text-foreground">
                {formatEventDateTime(nextEvent.starts_at)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-label">Location</dt>
              <dd className="text-foreground">
                {nextEvent.location?.trim() || "Location TBA"}
              </dd>
            </div>
          </dl>

          {nextEvent.description.trim() ? (
            <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-label">
              {nextEvent.description}
            </p>
          ) : null}

          <EventRsvpButton
            currentStatus={nextEvent.current_member_rsvp_status}
            canRsvp
            loading={rsvpLoading}
            embedded
            variant="segmented"
            onStatusChange={onRsvpStatusChange}
          />
        </div>

        {/* Right — calendar CTA */}
        <div className="flex shrink-0 items-center justify-stretch border-t border-gray-200 p-4 lg:w-44 lg:flex-col lg:justify-center lg:border-l lg:border-t-0 xl:w-48">
          <Link
            to="/events/calendar"
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-center text-sm font-semibold text-white transition duration-200 hover:bg-primary-hover"
          >
            View Calendar
          </Link>
        </div>
      </div>
    </section>
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
          <div className="ds-icon-label">
            <IconBadge icon={Users} category="members" size="sm" />
            <h2 className="text-lg font-semibold text-foreground">
              Next board meeting
            </h2>
          </div>
          <p className="mt-4 font-semibold text-foreground">{meeting.event_name}</p>
          <p className="mt-2 text-sm text-label">
            {formatEventDateTime(meeting.starts_at)}
          </p>
          {attendeeSummary ? (
            <p className="mt-2 text-sm text-label">{attendeeSummary}</p>
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
  category?: BadgeCategory;
};

const QUICK_LINK_CATEGORY: Record<string, BadgeCategory> = {
  "Past Events": "events",
  "Past events": "events",
  "Member Directory": "members",
  "Member directory": "members",
  "Task Oversight": "tasks",
  "Task oversight": "tasks",
  Finance: "finance",
  "AI assistant": "assistant",
};

export function QuickLinkCard({ title, description, to, icon, category }: QuickLink) {
  const toneCategory =
    category ?? QUICK_LINK_CATEGORY[title] ?? ("tools" as BadgeCategory);

  return (
    <Link
      to={to}
      className="group flex h-full min-h-[7.5rem] flex-col rounded-card border border-gray-200 bg-surface-muted/60 p-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white hover:shadow-card-hover"
    >
      <IconBadge icon={icon} category={toneCategory} size="md" />
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-label">
        {description}
      </p>
    </Link>
  );
}

export { HOME_ACTIVITY_MAX_HEIGHT_CLASS };
