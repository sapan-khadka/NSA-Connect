import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ListTodo,
  Megaphone,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/useAuth";
import type { MemberResponse } from "../../lib/auth-api";
import type { BadgeCategory } from "../../lib/badge-tones";
import type { EventTaskResponse } from "../../lib/event-tasks-api";
import {
  type EventResponse,
} from "../../lib/events-api";
import { eventDetailPath } from "../../lib/event-links";
import { formatEventDateTime } from "../../lib/format-datetime";
import { formatCurrency } from "../../lib/format-currency";
import { FINANCE_APPROVALS_PATH } from "../../lib/finance-routes";
import { type HomeActivity } from "../../lib/home-activities";
import { getTaskDisplayName, type MyTasksSummary } from "../../lib/home-tasks";
import type { MeetingSummary } from "../../lib/meetings-api";
import {
  canAccessFinance,
  canViewMemberDirectory,
  formatRoleLabel,
  isRoleAtLeast,
} from "../../lib/roles";
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
      label: `${pendingApprovalCount} approval${pendingApprovalCount === 1 ? "" : "s"} pending`,
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
          : "Budget needs review",
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
}: {
  member: MemberResponse;
  pendingApprovalCount?: number;
  nextEvent?: EventResponse | null;
  openTaskCount?: number;
  budgetBalance?: string | null;
  showBudgetChip?: boolean;
}) {
  const firstName = member.full_name.split(/\s+/)[0] ?? member.full_name;
  const roleLabel = formatRoleLabel(member.role);
  const greeting = greetingForNow();
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
      aria-label="Workspace welcome"
    >
      <img
        src={nsaCover}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-teal-950 via-teal-950/80 to-teal-950/45"
      />
      <div className="relative flex flex-col gap-3 px-5 py-5 sm:px-6 sm:py-6">
        <div className="min-w-0 text-white">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm font-medium text-white/85">
            {roleLabel}
            <span className="mx-1.5 text-white/40" aria-hidden="true">
              ·
            </span>
            NSA Connect
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
            Your workspace for what needs attention, what&apos;s next, and what to
            do today.
          </p>
        </div>

        {chips.length > 0 ? (
          <ul
            className="flex min-w-0 flex-wrap items-center gap-2"
            aria-label="Today at a glance"
          >
            {chips.map((chip) => (
              <li key={chip.id}>
                {chip.to ? (
                  <Link
                    to={chip.to}
                    className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/95 transition hover:border-white/40 hover:bg-white/15"
                  >
                    {chip.label}
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/95">
                    {chip.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
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
  const nextLabel = nextEvent ? `Next: ${nextEvent.name}` : "No upcoming events";

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

function formatTaskDueLabel(task: EventTaskResponse): string {
  if (task.is_overdue) {
    return "Overdue";
  }
  if (!task.due_date) {
    return "No due date";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(task.due_date));
}

export function HomeYourWorkSection({
  member,
  tasksSummary,
  tasksPath,
  isLoading,
  completingTaskId = null,
  taskCompleteError = null,
  onCompleteTask,
  pendingMemberApprovals = 0,
  financePendingCount = 0,
}: {
  member: MemberResponse;
  tasksSummary: MyTasksSummary;
  tasksPath: string;
  isLoading: boolean;
  completingTaskId?: number | null;
  taskCompleteError?: string | null;
  onCompleteTask?: (taskId: number) => void;
  pendingMemberApprovals?: number;
  financePendingCount?: number;
}) {
  const hasTasks = tasksSummary.openCount > 0;
  const canReviewMembers = canViewMemberDirectory(member.role);
  const attentionItems: Array<{ id: string; label: string; to: string }> = [];

  if (canReviewMembers && pendingMemberApprovals > 0) {
    attentionItems.push({
      id: "member-approvals",
      label: `${pendingMemberApprovals} member approval${pendingMemberApprovals === 1 ? "" : "s"} pending`,
      to: "/members?tab=pending",
    });
  }

  if (canAccessFinance(member.role) && financePendingCount > 0) {
    attentionItems.push({
      id: "finance-approvals",
      label: `${financePendingCount} finance review${financePendingCount === 1 ? "" : "s"} required`,
      to: FINANCE_APPROVALS_PATH,
    });
  }

  return (
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="home-section-title">My Tasks</h2>
        <ArrowLink to={tasksPath}>View all</ArrowLink>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {isLoading ? (
          <p className="text-sm font-normal text-gray-600">Loading tasks…</p>
        ) : null}

        {taskCompleteError ? (
          <p className="mb-2 text-sm text-overdue" role="alert">
            {taskCompleteError}
          </p>
        ) : null}

        {!isLoading && attentionItems.length > 0 ? (
          <ul className="mb-3 space-y-1.5">
            {attentionItems.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-2 text-sm font-medium text-foreground transition hover:border-amber-200"
                >
                  <AppIcon icon={AlertCircle} size="sm" className="text-amber-700" />
                  <span className="min-w-0 flex-1">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {!isLoading && hasTasks ? (
          <ul className="divide-y divide-gray-100">
            {tasksSummary.previewTasks.map((task) => {
              const dueLabel = formatTaskDueLabel(task);
              const completing = completingTaskId === task.id;
              return (
                <li key={task.id} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    aria-label={`Mark ${getTaskDisplayName(task)} complete`}
                    disabled={!onCompleteTask || completing}
                    onClick={() => onCompleteTask?.(task.id)}
                    className="group mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-primary transition hover:border-primary hover:bg-badge-teal-bg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <AppIcon
                      icon={Check}
                      size="xs"
                      className={
                        completing
                          ? "text-current opacity-100"
                          : "text-current opacity-0 group-hover:opacity-50"
                      }
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {getTaskDisplayName(task)}
                    </p>
                    <p
                      className={[
                        "mt-0.5 text-xs font-normal",
                        task.is_overdue ? "font-medium text-overdue" : "text-gray-500",
                      ].join(" ")}
                    >
                      {dueLabel}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {!isLoading && !hasTasks && attentionItems.length === 0 ? (
          <EmptyState
            icon="check"
            title="You're clear for now"
            description="No open tasks or reviews. Check back after the next event."
          />
        ) : null}
      </div>
    </HomeCard>
  );
}

export { HomeUpNextSection } from "./HomeUpcomingEventCard";

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
