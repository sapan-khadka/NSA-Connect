import type { EventTaskResponse } from "./event-tasks-api";
import type { MemberRole } from "./roles";

export function getTaskDisplayName(task: EventTaskResponse): string {
  if (task.task_kind === "checklist") {
    return task.group_name ?? task.title;
  }
  return task.title;
}

export type MyTasksSummary = {
  openCount: number;
  overdueCount: number;
  nextTask: EventTaskResponse | null;
  overdueTask: EventTaskResponse | null;
  /** Open tasks: overdue first, then soonest due date. */
  previewTasks: EventTaskResponse[];
};

const PREVIEW_LIMIT = 5;

export function sortOpenTasksForPreview(
  tasks: EventTaskResponse[],
): EventTaskResponse[] {
  return tasks
    .filter((task) => !task.is_complete)
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

export function summarizeMyTasks(tasks: EventTaskResponse[]): MyTasksSummary {
  const open = tasks.filter((task) => !task.is_complete);
  const sortedOpen = sortOpenTasksForPreview(tasks);
  const overdue = sortedOpen.filter((task) => task.is_overdue);
  const withDue = open
    .filter((task) => task.due_date)
    .sort(
      (left, right) =>
        new Date(left.due_date!).getTime() - new Date(right.due_date!).getTime(),
    );

  return {
    openCount: open.length,
    overdueCount: overdue.length,
    nextTask: withDue[0] ?? open[0] ?? null,
    overdueTask: overdue[0] ?? null,
    previewTasks: sortedOpen.slice(0, PREVIEW_LIMIT),
  };
}

export function getMyTasksPath(_role: MemberRole): string {
  return "/events/tasks";
}
