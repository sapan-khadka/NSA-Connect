import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ListTodo,
  Megaphone,
  Plus,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/useAuth";
import type { MemberResponse } from "../../lib/auth-api";
import type { BadgeCategory } from "../../lib/badge-tones";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_COLOR, EVENT_TYPE_LABELS } from "../../lib/event-types";
import {
  fetchEventAttendees,
  type EventResponse,
  type RsvpStatus,
} from "../../lib/events-api";
import { eventDetailPath } from "../../lib/event-links";
import { formatEventDateTime } from "../../lib/format-datetime";
import { formatCurrency } from "../../lib/format-currency";
import { FINANCE_APPROVALS_PATH } from "../../lib/finance-routes";
import { type HomeActivity } from "../../lib/home-activities";
import { getTaskDisplayName, type MyTasksSummary } from "../../lib/home-tasks";
import type { MeetingSummary } from "../../lib/meetings-api";
import { formatRoleLabel, isRoleAtLeast } from "../../lib/roles";
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

function greetingForNow(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) {
    return "Good Morning";
  }
  if (hour < 17) {
    return "Good Afternoon";
  }
  return "Good Evening";
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatNextEventChip(
  event: EventResponse,
  now = new Date(),
): string {
  const start = new Date(event.starts_at);
  if (Number.isNaN(start.getTime())) {
    return event.name;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(
    (startOfLocalDay(start) - startOfLocalDay(now)) / dayMs,
  );

  if (diffDays === 0) {
    return `${event.name} today`;
  }
  if (diffDays === 1) {
    return `${event.name} tomorrow`;
  }
  if (diffDays > 1 && diffDays < 7) {
    return `${event.name} ${start.toLocaleDateString(undefined, { weekday: "short" })}`;
  }
  return event.name;
}

function buildHeroStatusChips({
  pendingApprovalCount,
  nextEvent,
  openTaskCount,
  budgetBalance,
  showBudgetChip,
}: {
  pendingApprovalCount: number;
  nextEvent: EventResponse | null;
  openTaskCount: number;
  budgetBalance: string | null;
  showBudgetChip: boolean;
}): Array<{ id: string; label: string; to?: string }> {
  const chips: Array<{ id: string; label: string; to?: string }> = [];

  if (pendingApprovalCount > 0) {
    chips.push({
      id: "approvals",
      label: `${pendingApprovalCount} approval${pendingApprovalCount === 1 ? "" : "s"} waiting`,
      to: FINANCE_APPROVALS_PATH,
    });
  }

  if (nextEvent) {
    chips.push({
      id: "next-event",
      label: formatNextEventChip(nextEvent),
      to: eventDetailPath(nextEvent.id),
    });
  }

  if (showBudgetChip && budgetBalance != null && budgetBalance !== "") {
    const amount = Number(budgetBalance);
    chips.push({
      id: "budget",
      label:
        Number.isFinite(amount) && amount >= 0
          ? "Budget healthy"
          : "Budget needs attention",
      to: "/finance",
    });
  }

  if (openTaskCount > 0) {
    chips.push({
      id: "tasks",
      label: `${openTaskCount} assigned task${openTaskCount === 1 ? "" : "s"}`,
    });
  }

  return chips.slice(0, 4);
}

export function HomeWelcomeBanner({
  member,
  pendingApprovalCount = 0,
  nextEvent = null,
  openTaskCount = 0,
  budgetBalance = null,
  showBudgetChip = false,
  showLogTransaction = false,
  onLogTransaction,
}: {
  member: MemberResponse;
  pendingApprovalCount?: number;
  nextEvent?: EventResponse | null;
  openTaskCount?: number;
  budgetBalance?: string | null;
  showBudgetChip?: boolean;
  showLogTransaction?: boolean;
  onLogTransaction?: () => void;
}) {
  const firstName = member.full_name.split(/\s+/)[0] ?? member.full_name;
  const roleLabel = formatRoleLabel(member.role);
  const chips = buildHeroStatusChips({
    pendingApprovalCount,
    nextEvent,
    openTaskCount,
    budgetBalance,
    showBudgetChip,
  });

  return (
    <section
      className="relative overflow-hidden rounded-xl"
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
        className="absolute inset-0 bg-gradient-to-r from-teal-950 via-teal-950/75 to-teal-950/40"
      />
      <div className="relative flex min-h-[80px] flex-col gap-2 px-4 py-3 sm:min-h-[88px] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 shrink-0 text-white">
            <h1 className="truncate text-lg font-bold leading-tight tracking-tight text-white sm:text-xl">
              Welcome back, {firstName}
              <span className="mx-1.5 font-normal text-white/40" aria-hidden="true">
                ·
              </span>
              <span className="text-sm font-normal tracking-[0.01em] text-white/80">
                {roleLabel}
              </span>
            </h1>
          </div>

          {chips.length > 0 ? (
            <ul
              className="flex min-w-0 flex-wrap items-center gap-1.5"
              aria-label="Today at a glance"
            >
              {chips.map((chip) => (
                <li key={chip.id}>
                  {chip.to ? (
                    <Link
                      to={chip.to}
                      className="inline-flex items-center rounded-md border border-white/30 bg-white/5 px-2 py-0.5 text-[11px] font-normal leading-relaxed tracking-[0.03em] text-white/90 transition hover:border-white/45 hover:bg-white/10"
                    >
                      {chip.label}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-white/30 bg-white/5 px-2 py-0.5 text-[11px] font-normal leading-relaxed tracking-[0.03em] text-white/90">
                      {chip.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {showLogTransaction && onLogTransaction ? (
          <div className="flex shrink-0">
            <button
              type="button"
              onClick={onLogTransaction}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-sm font-medium text-foreground transition hover:bg-white"
            >
              <AppIcon icon={Plus} size="sm" className="text-current" />
              Log transaction
            </button>
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
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const content = (
          <>
            <div className="flex items-center gap-2">
              <IconBadge
                icon={card.icon}
                tone="gray"
                size="xs"
                shape="rounded"
              />
              <p className="truncate text-xs font-normal leading-relaxed tracking-[0.04em] text-gray-500">
                {card.label}
              </p>
            </div>
            <p className="home-stat-value mt-2">{card.value}</p>
            <p
              className={[
                "mt-1 line-clamp-1 text-xs font-normal leading-relaxed tracking-[0.01em]",
                card.hintUrgent ? "text-overdue" : "text-gray-500",
              ].join(" ")}
            >
              {card.hint}
            </p>
          </>
        );

        const className =
          "group flex h-full min-h-0 flex-col justify-center rounded-xl bg-white px-3.5 py-3 shadow-sm transition duration-200 ease-out hover:shadow-md xl:min-h-[96px]";

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

function activityTimeLabel(activity: HomeActivity): string {
  return activity.kind === "recent" ? "Recent" : "Needs attention";
}

export function ActivityRow({
  activity,
  isLast = false,
}: {
  activity: HomeActivity;
  isLast?: boolean;
}) {
  const visual = activityVisual(activity);
  const title = activityTitle(activity);

  return (
    <li className="relative list-none">
      <Link
        to={activity.to}
        className="group relative flex gap-3 rounded-card px-1.5 py-2 transition duration-200 ease-out hover:bg-surface-muted"
      >
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
              className="mt-1.5 w-px flex-1 bg-gray-200"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium leading-snug text-foreground group-hover:text-primary">
              {title}
            </p>
            <span className="shrink-0 pt-0.5 text-xs font-normal tracking-[0.02em] text-gray-500">
              {activityTimeLabel(activity)}
            </span>
          </div>
          <p className="text-sm font-normal leading-snug text-gray-600">
            {activity.message}
          </p>
        </div>
      </Link>
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
    <HomeCard
      padding="sm"
      className="flex h-full flex-col"
      aria-label="Activity"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="ds-icon-label">
          <IconBadge icon={ListTodo} category="tasks" size="sm" />
          <h2 className="text-lg font-semibold text-foreground">Activity</h2>
        </div>
        {isTruncated ? <ArrowLink to={tasksPath}>View all</ArrowLink> : null}
      </div>

      <div className="mt-3 flex flex-col">
        {isLoading ? (
          <p className="text-sm font-normal text-gray-600">Loading activity…</p>
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
              "space-y-0",
              scrollable ? "max-h-64 overflow-y-auto pr-1" : "",
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
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="home-section-title">Your Work</h2>
        <ArrowLink to={tasksPath}>View all</ArrowLink>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {isLoading ? (
          <p className="text-sm font-normal text-gray-600">Loading tasks…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-surface-muted px-2.5 py-2">
                <p className="text-xs font-normal leading-relaxed tracking-[0.04em] text-gray-500">
                  Open Tasks
                </p>
                <p className="home-stat-value mt-1">{tasksSummary.openCount}</p>
              </div>
              <div
                className={
                  tasksSummary.overdueCount > 0
                    ? "rounded-lg border border-overdue/15 bg-overdue-surface px-2.5 py-2"
                    : "rounded-lg bg-surface-muted px-2.5 py-2"
                }
              >
                <p
                  className={
                    tasksSummary.overdueCount > 0
                      ? "text-xs font-normal leading-relaxed tracking-[0.04em] text-overdue"
                      : "text-xs font-normal leading-relaxed tracking-[0.04em] text-gray-500"
                  }
                >
                  Overdue
                </p>
                <p
                  className={
                    tasksSummary.overdueCount > 0
                      ? "home-stat-value mt-1 text-overdue"
                      : "home-stat-value mt-1"
                  }
                >
                  {tasksSummary.overdueCount}
                </p>
                {tasksSummary.overdueTask ? (
                  <p
                    className={
                      tasksSummary.overdueCount > 0
                        ? "mt-1 truncate text-xs font-normal leading-relaxed text-overdue"
                        : "mt-1 truncate text-xs font-normal leading-relaxed text-gray-600"
                    }
                  >
                    Overdue: {getTaskDisplayName(tasksSummary.overdueTask)}
                    {tasksSummary.overdueCount > 1
                      ? ` +${tasksSummary.overdueCount - 1}`
                      : ""}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg bg-surface-muted/60 px-2.5 py-2">
              <p className="text-xs font-normal leading-relaxed tracking-[0.04em] text-gray-500">
                Next Due
              </p>
              {tasksSummary.nextTask ? (
                <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                  {getTaskDisplayName(tasksSummary.nextTask)}
                </p>
              ) : (
                <p className="mt-0.5 text-sm font-normal text-gray-600">
                  No upcoming due dates
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </HomeCard>
  );
}

function formatUpcomingEventDate(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoDate));
}

function formatUpcomingEventTime(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeStyle: "short",
  }).format(new Date(isoDate));
}

function formatEventCountdown(isoDate: string, now = new Date()): string {
  const start = new Date(isoDate).getTime();
  const diffMs = start - now.getTime();

  if (!Number.isFinite(diffMs)) {
    return "Soon";
  }
  if (diffMs <= 0) {
    return "Happening now";
  }

  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);

  if (days > 1) {
    return `In ${days} days`;
  }
  if (days === 1) {
    return "Tomorrow";
  }
  if (hours >= 1) {
    return `In ${hours} hr`;
  }

  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  return `In ${minutes} min`;
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
  const { member } = useAuth();
  const canManage = member ? isRoleAtLeast(member.role, "board") : false;
  const [goingCount, setGoingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!nextEvent) {
      setGoingCount(null);
      return;
    }

    const eventId = nextEvent.id;
    let cancelled = false;

    void fetchEventAttendees(eventId)
      .then((response) => {
        if (!cancelled) {
          setGoingCount(response.going_count);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGoingCount(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [nextEvent?.id]);

  if (isLoading) {
    return (
      <HomeCard
        padding="sm"
        className="flex h-full min-h-0 flex-col home-surface-quiet"
      >
        <h2 className="home-section-title">Upcoming Event</h2>
        <p className="mt-2 text-sm font-normal text-gray-600">Loading events…</p>
      </HomeCard>
    );
  }

  if (!nextEvent) {
    return (
      <HomeCard
        padding="sm"
        className="flex h-full min-h-0 flex-col home-surface-quiet"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="home-section-title">Upcoming Event</h2>
          <Link
            to="/events/calendar"
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            View calendar
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

  const eventPath = eventDetailPath(nextEvent.id);
  const managePath = `/events/${nextEvent.id}/manage`;

  return (
    <section className="grid h-full min-h-0 grid-cols-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-none md:grid-cols-[minmax(0,30%)_minmax(0,70%)] md:max-h-[18rem]">
      <div className="relative h-16 w-full min-w-0 shrink-0 overflow-hidden sm:h-[4.5rem] md:h-auto md:min-h-0 md:self-stretch">
        {nextEvent.event_photo_url ? (
          <img
            src={nextEvent.event_photo_url}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(145deg, ${EVENT_TYPE_COLOR[nextEvent.event_type]}33 0%, ${EVENT_TYPE_COLOR[nextEvent.event_type]} 100%)`,
            }}
          />
        )}
        <span
          className={`pointer-events-none absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm ${EVENT_TYPE_BADGE_CLASS[nextEvent.event_type]}`}
        >
          {EVENT_TYPE_LABELS[nextEvent.event_type]}
        </span>
      </div>

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-normal uppercase tracking-[0.06em] text-gray-500">
            Upcoming Event
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              to="/events/calendar"
              className="relative z-10 text-xs font-medium text-primary hover:text-primary-hover"
            >
              View calendar
            </Link>
            {canManage ? (
              <Link
                to={managePath}
                className="relative z-10 text-xs font-medium text-primary hover:text-primary-hover"
              >
                Manage
              </Link>
            ) : null}
          </div>
        </div>

        <Link
          to={eventPath}
          className="relative z-10 mb-1 block text-base font-medium leading-snug tracking-tight text-foreground transition-colors hover:text-primary md:text-lg md:leading-snug"
        >
          {nextEvent.name}
        </Link>

        <div className="min-w-0 space-y-1">
          <p className="break-words text-xs font-normal leading-relaxed text-gray-600">
            {formatUpcomingEventDate(nextEvent.starts_at)}
            <span className="mx-1 text-gray-300" aria-hidden="true">
              ·
            </span>
            {formatUpcomingEventTime(nextEvent.starts_at)}
          </p>
          <p className="break-words text-xs font-normal leading-relaxed text-gray-500">
            {nextEvent.location?.trim() || "Location TBA"}
            <span className="mx-1 text-gray-300" aria-hidden="true">
              ·
            </span>
            {goingCount === null ? "…" : `${goingCount} going`}
            <span className="mx-1 text-gray-300" aria-hidden="true">
              ·
            </span>
            {formatEventCountdown(nextEvent.starts_at)}
          </p>
        </div>

        <div className="relative z-10 mt-auto min-w-0 max-w-full shrink-0 pt-1">
          <EventRsvpButton
            currentStatus={nextEvent.current_member_rsvp_status}
            canRsvp
            loading={rsvpLoading}
            embedded
            variant="segmented"
            onStatusChange={onRsvpStatusChange}
          />
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
  description?: string;
  to?: string;
  onClick?: () => void;
  icon: LucideIcon;
  category?: BadgeCategory;
};

export function QuickLinkCard({
  title,
  description,
  to,
  onClick,
  icon,
  compact = false,
}: QuickLink & { compact?: boolean }) {
  const className = [
    "group flex items-center gap-2 rounded-lg border border-gray-100 bg-white text-left shadow-sm",
    compact
      ? "px-2.5 py-2"
      : "h-auto min-h-0 flex-col items-start gap-1.5 px-3 py-2.5",
    "transition duration-200 ease-out hover:border-gray-200 hover:shadow-md",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
  ].join(" ");

  const content = (
    <>
      <IconBadge icon={icon} tone="gray" size="xs" shape="rounded" />
      <span className="min-w-0 truncate text-sm font-medium text-foreground">
        {title}
      </span>
      {!compact && description ? (
        <span className="line-clamp-1 text-xs font-normal leading-relaxed text-gray-500">
          {description}
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  if (!to) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
}

export { HOME_ACTIVITY_MAX_HEIGHT_CLASS };
