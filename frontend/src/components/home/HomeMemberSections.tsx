import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { MemberResponse } from "../../lib/auth-api";
import type { EventTaskResponse } from "../../lib/event-tasks-api";
import type { EventResponse } from "../../lib/events-api";
import { FINANCE_APPROVALS_PATH } from "../../lib/finance-routes";
import {
  filterTasksForTab,
  getTaskDisplayName,
  type MyTasksSummary,
  type MyTasksTab,
} from "../../lib/home-tasks";
import { buildHomeUrgencyLine } from "../../lib/home-urgency";
import {
  canManageTreasury,
  canViewMemberDirectory,
} from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

function greetingForNow(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 17) {
    return "Good afternoon";
  }
  return "Good evening";
}

export function HomeWelcomeBanner({
  member,
  calmLine,
}: {
  member: MemberResponse;
  /** Soft supporting line when there are no urgency chips. */
  calmLine?: string;
}) {
  const firstName = member.full_name.split(/\s+/)[0] ?? member.full_name;
  const greeting = greetingForNow();
  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <section
      className="home-welcome flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Workspace welcome"
    >
      <div className="min-w-0">
        <h1 className="home-welcome-title text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-[1.5rem]">
          {greeting}, {firstName}{" "}
          <span aria-hidden="true">👋</span>
        </h1>
        <p className="home-welcome-copy mt-0.5 max-w-xl text-sm text-gray-500">
          {calmLine ?? "Here’s what’s happening with your chapter today."}
        </p>
      </div>
      <p className="home-welcome-date shrink-0 text-sm font-medium tabular-nums text-gray-500">
        {todayLabel}
      </p>
    </section>
  );
}

function isDueToday(isoDate: string | null | undefined, now = new Date()): boolean {
  if (!isoDate) {
    return false;
  }
  const due = new Date(isoDate);
  if (Number.isNaN(due.getTime())) {
    return false;
  }
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

function formatTaskDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

function TaskRow({
  task,
  completing,
  onCompleteTask,
}: {
  task: EventTaskResponse;
  completing: boolean;
  onCompleteTask?: (taskId: number) => void;
}) {
  const dueToday = isDueToday(task.due_date);
  const dateLabel = formatTaskDate(task.due_date) ?? "No date";
  const dueClass = [
    "home-task-due-text",
    task.is_overdue ? "is-overdue" : "",
    !task.is_overdue && dueToday ? "is-today" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className="home-task-row">
      <button
        type="button"
        aria-label={`Mark ${getTaskDisplayName(task)} complete`}
        disabled={!onCompleteTask || completing}
        onClick={() => onCompleteTask?.(task.id)}
        className="home-task-check group"
      >
        <AppIcon
          icon={Check}
          size="xs"
          className={
            completing
              ? "text-current opacity-100"
              : "text-current opacity-0 group-hover:opacity-70"
          }
        />
      </button>
      <p className="home-task-title">{getTaskDisplayName(task)}</p>
      <span className={dueClass}>{dateLabel}</span>
    </li>
  );
}

function pickDefaultTab(summary: MyTasksSummary): MyTasksTab {
  if (summary.overdueCount > 0) {
    return "overdue";
  }
  if (summary.dueTodayCount > 0) {
    return "today";
  }
  return "upcoming";
}

export function HomeYourWorkSection({
  tasksSummary,
  tasksPath,
  isLoading,
  completingTaskId = null,
  taskCompleteError = null,
  onCompleteTask,
  embedded = false,
}: {
  member?: MemberResponse;
  tasksSummary: MyTasksSummary;
  tasksPath: string;
  isLoading: boolean;
  completingTaskId?: number | null;
  taskCompleteError?: string | null;
  onCompleteTask?: (taskId: number) => void;
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<MyTasksTab>("upcoming");
  const [userPickedTab, setUserPickedTab] = useState(false);

  useEffect(() => {
    if (!isLoading && !userPickedTab) {
      setTab(pickDefaultTab(tasksSummary));
    }
  }, [isLoading, tasksSummary, userPickedTab]);

  const tabTasks = filterTasksForTab(tasksSummary, tab).slice(0, 6);
  const emptyCopy =
    tab === "overdue"
      ? "No overdue tasks."
      : tab === "today"
        ? "Nothing due today."
        : "No upcoming tasks.";

  const body = (
    <div className="home-task-panel">
      {!embedded ? (
        <div className="home-task-header">
          <h2 className="home-panel-title">My tasks</h2>
          <ArrowLink to={tasksPath}>View all</ArrowLink>
        </div>
      ) : (
        <div className="home-task-header home-task-header--embedded">
          <ArrowLink to={tasksPath}>View all</ArrowLink>
        </div>
      )}

      {!isLoading ? (
        <div
          className="home-task-tabs"
          role="tablist"
          aria-label="Task summary"
        >
          {(
            [
              {
                id: "overdue" as const,
                label: "Overdue",
                count: tasksSummary.overdueCount,
              },
              {
                id: "today" as const,
                label: "Today",
                count: tasksSummary.dueTodayCount,
              },
              {
                id: "upcoming" as const,
                label: "Upcoming",
                count: tasksSummary.upcomingCount,
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={[
                "home-task-tab",
                tab === item.id ? "is-active" : "",
                item.id === "overdue" && item.count > 0 ? "is-overdue" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setUserPickedTab(true);
                setTab(item.id);
              }}
            >
              <span>{item.label}</span>
              <span className="home-task-tab-count">{item.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="home-task-body">
        {isLoading ? (
          <ul className="home-task-list" aria-label="Loading tasks">
            {[0, 1, 2].map((row) => (
              <li key={row} className="home-task-skeleton">
                <span className="h-4 w-4 animate-pulse rounded-[0.3rem] bg-slate-200/80" />
                <span className="block h-2.5 w-3/5 animate-pulse rounded bg-slate-200/80" />
                <span className="h-2 w-10 justify-self-end animate-pulse rounded bg-slate-200/60" />
              </li>
            ))}
          </ul>
        ) : null}

        {taskCompleteError ? (
          <p className="home-task-error" role="alert">
            {taskCompleteError}
          </p>
        ) : null}

        {!isLoading && tabTasks.length > 0 ? (
          <ul className="home-task-list">
            {tabTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                completing={completingTaskId === task.id}
                onCompleteTask={onCompleteTask}
              />
            ))}
          </ul>
        ) : null}

        {!isLoading && tabTasks.length === 0 ? (
          <div className="home-task-empty">
            <p className="home-task-empty-title">
              {tasksSummary.openCount === 0 ? "You're clear" : "All clear"}
            </p>
            <p className="home-task-empty-copy">
              {tasksSummary.openCount === 0
                ? "No open tasks right now."
                : emptyCopy}
            </p>
          </div>
        ) : null}
      </div>

      <div className="home-task-footer">
        <Link to={tasksPath} className="home-panel-footer-link">
          + Add new task
        </Link>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-col" aria-label="My Tasks">
        {body}
      </div>
    );
  }

  return (
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet home-task-card"
      aria-label="My Tasks"
    >
      {body}
    </HomeCard>
  );
}

export function buildWelcomeUrgency({
  tasksSummary,
  pendingMemberApprovals,
  financePendingCount,
  nextEvent,
  member,
}: {
  tasksSummary: MyTasksSummary;
  pendingMemberApprovals: number;
  financePendingCount: number;
  nextEvent: EventResponse | null;
  member: MemberResponse;
}): string {
  const canReviewMembers = canViewMemberDirectory(member.role);
  const canReviewFinance = canManageTreasury(member.role, member.position);
  const pendingReviewCount =
    (canReviewMembers ? pendingMemberApprovals : 0) +
    (canReviewFinance ? financePendingCount : 0);

  return buildHomeUrgencyLine({
    overdueCount: tasksSummary.overdueCount,
    dueTodayCount: tasksSummary.dueTodayCount,
    pendingReviewCount,
    nextEvent,
  });
}

export function getPendingReviewCount({
  member,
  pendingMemberApprovals,
  financePendingCount,
}: {
  member: MemberResponse;
  pendingMemberApprovals: number;
  financePendingCount: number;
}): number {
  const members = canViewMemberDirectory(member.role)
    ? pendingMemberApprovals
    : 0;
  const finance = canManageTreasury(member.role, member.position)
    ? financePendingCount
    : 0;
  return members + finance;
}

export function canShowNeedsReview(member: MemberResponse): boolean {
  return (
    canViewMemberDirectory(member.role) ||
    canManageTreasury(member.role, member.position)
  );
}

export function getNeedsReviewPath({
  member,
  pendingMemberApprovals,
  financePendingCount,
}: {
  member: MemberResponse;
  pendingMemberApprovals: number;
  financePendingCount: number;
}): string {
  const canReviewMembers = canViewMemberDirectory(member.role);
  const canReviewFinance = canManageTreasury(member.role, member.position);
  if (canReviewMembers && pendingMemberApprovals > 0) {
    return "/members?tab=pending";
  }
  if (canReviewFinance && financePendingCount > 0) {
    return FINANCE_APPROVALS_PATH;
  }
  if (canReviewMembers) {
    return "/members?tab=pending";
  }
  return FINANCE_APPROVALS_PATH;
}
