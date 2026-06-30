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
};

export function summarizeMyTasks(tasks: EventTaskResponse[]): MyTasksSummary {
  const open = tasks.filter((task) => !task.is_complete);
  const overdue = open.filter((task) => task.is_overdue);
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
  };
}

export function getMyTasksPath(_role: MemberRole): string {
  return "/tasks";
}
