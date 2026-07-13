import { EventFinanceCloseoutBanner } from "./EventFinanceCloseoutBanner";
import { EventTaskManager } from "./EventTaskManager";
import { FinanceEntryList } from "./FinanceEntryList";
import type { ReactNode } from "react";
import type { MemberResponse } from "../lib/auth-api";
import { canCreateEventTasks } from "../lib/event-finance";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import type { EventDetailResponse } from "../lib/events-api";
import type { EventTaskDraft } from "../lib/event-task-draft";
import {
  budgetProgressBarClass,
  budgetStatusClass,
  budgetStatusLabel,
  budgetUsagePercent,
  formatBudgetRemaining,
} from "../lib/event-budget";
import { formatCurrency } from "../lib/format-currency";
import { Card } from "./ui/Card";

/** Internal scroll for dense lists so the manage tab stays viewport-sized. */
export const MANAGE_PANEL_SCROLL_CLASS =
  "min-h-0 max-h-[min(24rem,calc(100vh-18rem))] overflow-y-auto overscroll-contain";

type SharedLogisticsProps = {
  event: EventDetailResponse;
  budget: FinanceEventBudgetSummary | null;
  tasks: EventTaskResponse[];
  member: MemberResponse | null;
  canViewBoard: boolean;
  canViewTreasury: boolean;
  canManageTasks: boolean;
  assignableMembers: MemberResponse[];
  refreshKey: number;
  onRefresh: () => void;
  taskDraft?: EventTaskDraft | null;
  onTaskDraftApplied?: () => void;
};

export function EventManageTaskProgressCard({
  tasks,
}: {
  tasks: EventTaskResponse[];
}) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === "done").length;
  const inProgress = tasks.filter(
    (task) => task.status === "in_progress",
  ).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  return (
    <Card padding="md">
      <h2 className="text-lg font-light tracking-subhead text-foreground">
        Task completion
      </h2>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
          {completed}/{total} done ({percent}%)
        </span>
        <span className="text-sm text-label">{inProgress} in progress</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </Card>
  );
}

export function EventManageBudgetSummaryCard({
  budget,
}: {
  budget: FinanceEventBudgetSummary;
}) {
  const usagePercent = budgetUsagePercent(
    budget.planned_budget,
    budget.actual_expense,
  );

  return (
    <Card padding="md">
      <h2 className="text-lg font-light tracking-subhead text-foreground">
        Event budget
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-label">Planned</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatCurrency(budget.planned_budget)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-label">Expenses</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatCurrency(budget.actual_expense)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-label">Income</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatCurrency(budget.actual_income)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-label">Remaining</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatBudgetRemaining(budget.budget_remaining)}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-label">
          <span>Budget usage</span>
          <span>{usagePercent}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${budgetProgressBarClass(budget)}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <p className={`mt-2 text-sm ${budgetStatusClass(budget)}`}>
          {budgetStatusLabel(budget)}
        </p>
      </div>
    </Card>
  );
}

export function EventManageTasksPanel({
  event,
  tasks,
  member,
  canViewBoard,
  canManageTasks,
  assignableMembers,
  refreshKey,
  taskDraft = null,
  onTaskDraftApplied,
  sidebar = null,
}: Pick<
  SharedLogisticsProps,
  | "event"
  | "tasks"
  | "member"
  | "canViewBoard"
  | "canManageTasks"
  | "assignableMembers"
  | "refreshKey"
  | "taskDraft"
  | "onTaskDraftApplied"
> & {
  sidebar?: ReactNode;
}) {
  if (!canViewBoard) {
    return null;
  }

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
      <div className="min-h-0 space-y-4">
        <EventManageTaskProgressCard tasks={tasks} />
        {sidebar}
      </div>
      <Card as="div" padding="md" className="min-h-0">
        <div className={MANAGE_PANEL_SCROLL_CLASS}>
          <EventTaskManager
            key={`${event.id}-${refreshKey}`}
            eventId={event.id}
            eventName={event.name}
            member={member}
            canManageSimple={canManageTasks}
            canCreateTasks={canCreateEventTasks(event)}
            canAssignChecklist={canViewBoard}
            assignableMembers={assignableMembers}
            refreshKey={refreshKey}
            taskDraft={taskDraft}
            onTaskDraftApplied={onTaskDraftApplied}
          />
        </div>
      </Card>
    </div>
  );
}

export function EventManageBudgetPanel({
  event,
  budget,
  canViewTreasury,
  refreshKey,
  onRefresh,
}: Pick<
  SharedLogisticsProps,
  "event" | "budget" | "canViewTreasury" | "refreshKey" | "onRefresh"
>) {
  return (
    <div className="space-y-4">
      <EventFinanceCloseoutBanner event={event} />

      {budget ? <EventManageBudgetSummaryCard budget={budget} /> : null}

      {canViewTreasury ? (
        <div className={MANAGE_PANEL_SCROLL_CLASS}>
          <FinanceEntryList
            semester="all"
            refreshKey={refreshKey}
            eventId={event.id}
            canManage={!event.is_finance_locked}
            financeLocked={event.is_finance_locked}
            onChanged={onRefresh}
          />
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer tab-specific panels; kept for any external imports. */
export function EventManageLogisticsSection(props: SharedLogisticsProps) {
  return (
    <div className="space-y-6">
      <EventManageTasksPanel {...props} />
      <EventManageBudgetPanel {...props} />
    </div>
  );
}
