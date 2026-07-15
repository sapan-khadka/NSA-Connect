/**
 * Member Workspace — Current Responsibilities helpers.
 * Derives display from real EventTaskResponse fields only.
 */

import type { EventTaskResponse, EventTaskStatus } from "./event-tasks-api";
import { getTaskDisplayName } from "./home-tasks";
import { calcChecklistTaskProgress, type TaskProgress } from "./task-progress";

export const TASK_STATUS_LABELS: Record<EventTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export type MemberResponsibilityItem = {
  id: number;
  title: string;
  eventName: string;
  status: EventTaskStatus;
  statusLabel: string;
  dueDateLabel: string | null;
  isOverdue: boolean;
  /** Never invent names — API only exposes created_by_id. */
  assignedByLabel: string | null;
  /** Checklist item progress when the task has real checklist items. */
  progress: TaskProgress | null;
  detailPath: string;
};

/** Open / in-flight work — not completed. */
export function selectCurrentResponsibilityTasks(
  tasks: EventTaskResponse[],
): EventTaskResponse[] {
  return tasks
    .filter((task) => !task.is_complete && task.status !== "done")
    .sort((left, right) => {
      if (left.is_overdue !== right.is_overdue) {
        return left.is_overdue ? -1 : 1;
      }
      const leftDue = left.due_date
        ? new Date(left.due_date).getTime()
        : Number.POSITIVE_INFINITY;
      const rightDue = right.due_date
        ? new Date(right.due_date).getTime()
        : Number.POSITIVE_INFINITY;
      return leftDue - rightDue;
    });
}

export function formatResponsibilityDueDate(
  dueDate: string | null,
): string | null {
  if (!dueDate) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dueDate));
}

export function responsibilityProgress(
  task: EventTaskResponse,
): TaskProgress | null {
  if (task.task_kind !== "checklist" || task.checklist_items.length === 0) {
    return null;
  }
  return calcChecklistTaskProgress(task);
}

/**
 * Deep-link to the closest existing task surface (no new routes).
 * Assignees use the shared tasks board; managers land on event Manage tasks.
 */
export function getResponsibilityTaskPath(
  task: EventTaskResponse,
  options: { canOpenEventManage: boolean },
): string {
  if (options.canOpenEventManage) {
    return `/events/${task.event_id}/manage`;
  }
  return "/events/tasks";
}

export function getResponsibilitiesViewAllPath(options: {
  canViewOversight: boolean;
}): string {
  return options.canViewOversight ? "/events/oversight" : "/events/tasks";
}

export function getAssignTaskPath(options: {
  canManageEventTasks: boolean;
}): string | null {
  if (!options.canManageEventTasks) {
    return null;
  }
  return "/events/calendar";
}

export function buildResponsibilityItems(
  tasks: EventTaskResponse[],
  options: { canOpenEventManage: boolean },
): MemberResponsibilityItem[] {
  return selectCurrentResponsibilityTasks(tasks).map((task) => ({
    id: task.id,
    title: getTaskDisplayName(task),
    eventName: task.event_name,
    status: task.status,
    statusLabel: TASK_STATUS_LABELS[task.status],
    dueDateLabel: formatResponsibilityDueDate(task.due_date),
    isOverdue: task.is_overdue,
    assignedByLabel: null,
    progress: responsibilityProgress(task),
    detailPath: getResponsibilityTaskPath(task, options),
  }));
}
