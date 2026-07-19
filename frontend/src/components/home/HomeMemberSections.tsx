import { Check } from "lucide-react";

import type { MemberResponse } from "../../lib/auth-api";
import type { EventTaskResponse } from "../../lib/event-tasks-api";
import type { EventResponse } from "../../lib/events-api";
import { FINANCE_APPROVALS_PATH } from "../../lib/finance-routes";
import {
  getTaskDisplayName,
  type MyTasksSummary,
} from "../../lib/home-tasks";
import { buildHomeUrgencyLine } from "../../lib/home-urgency";
import {
  canManageTreasury,
  canViewMemberDirectory,
} from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";
import { ArrowLink } from "../ui/ArrowLink";
import { EmptyState } from "../ui/EmptyState";
import { HomeCard } from "../ui/HomeCard";

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
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <section
      className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"
      aria-label="Workspace welcome"
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
          {greeting}, {firstName}
        </h1>
        {calmLine ? (
          <p className="mt-1 text-sm text-gray-500">{calmLine}</p>
        ) : null}
      </div>
      <p className="shrink-0 text-xs font-medium tabular-nums text-gray-400">
        {todayLabel}
      </p>
    </section>
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
  const hasTasks = tasksSummary.openCount > 0;

  const body = (
    <>
      {!embedded ? (
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h2 className="home-section-title">My Tasks</h2>
          <ArrowLink to={tasksPath}>View all</ArrowLink>
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-end">
          <ArrowLink to={tasksPath}>View all</ArrowLink>
        </div>
      )}

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {isLoading ? (
          <ul className="space-y-3" aria-label="Loading tasks">
            {[0, 1, 2].map((row) => (
              <li key={row} className="flex gap-2">
                <span className="mt-0.5 h-4 w-4 animate-pulse rounded bg-slate-200/80" />
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="block h-3 w-2/3 animate-pulse rounded bg-slate-200/80" />
                  <span className="block h-2.5 w-1/3 animate-pulse rounded bg-slate-200/60" />
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {taskCompleteError ? (
          <p className="mb-2 text-xs text-overdue" role="alert">
            {taskCompleteError}
          </p>
        ) : null}

        {!isLoading && hasTasks ? (
          <ul className="divide-y divide-gray-100/80">
            {tasksSummary.previewTasks.slice(0, 5).map((task) => {
              const dueLabel = formatTaskDueLabel(task);
              const completing = completingTaskId === task.id;
              return (
                <li
                  key={task.id}
                  className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0"
                >
                  <button
                    type="button"
                    aria-label={`Mark ${getTaskDisplayName(task)} complete`}
                    disabled={!onCompleteTask || completing}
                    onClick={() => onCompleteTask?.(task.id)}
                    className="group mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-primary transition hover:border-primary hover:bg-badge-teal-bg disabled:cursor-not-allowed disabled:opacity-60"
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
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {task.event_name ? `${task.event_name} · ` : ""}
                      <span
                        className={
                          task.is_overdue
                            ? "font-medium text-overdue"
                            : "text-gray-500"
                        }
                      >
                        {dueLabel}
                      </span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {!isLoading && !hasTasks ? (
          <EmptyState
            icon="check"
            title="You're clear"
            description="No open tasks right now."
          />
        ) : null}
      </div>
    </>
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
      className="flex h-full min-h-0 flex-col home-surface-quiet"
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
