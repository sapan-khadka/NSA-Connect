import { isToday } from "./calendar";
import type {
  EventTaskResponse,
  UpdateEventTaskRequest,
} from "./event-tasks-api";
import type { MemberRole } from "./roles";

export type TaskUrgency = "high" | "medium" | "low";

/** Visual urgency for open tasks — derived from due state (no stored priority). */
export function getTaskUrgency(
  task: EventTaskResponse,
  now = new Date(),
): TaskUrgency {
  // Completed work isn't urgent anymore, even if the due date was missed.
  if (task.is_complete || task.status === "done") {
    return "low";
  }
  if (task.is_overdue) {
    return "high";
  }
  if (task.due_date && isToday(new Date(task.due_date), now)) {
    return "medium";
  }
  return "low";
}

export function countDueTodayTasks(
  tasks: EventTaskResponse[],
  now = new Date(),
): number {
  return tasks.filter(
    (task) =>
      !task.is_complete &&
      !task.is_overdue &&
      task.due_date != null &&
      isToday(new Date(task.due_date), now),
  ).length;
}

export function getTaskDisplayName(task: EventTaskResponse): string {
  if (task.task_kind === "checklist") {
    return task.group_name ?? task.title;
  }
  return task.title;
}

/**
 * Payload for marking a home / My Tasks row complete.
 * Simple tasks use `status: "done"` (Event Manage / kanban); checklist groups use
 * `is_complete: true` — the backend ignores `is_complete` on simple tasks.
 */
export function buildMarkTaskCompleteRequest(
  task: EventTaskResponse,
): UpdateEventTaskRequest {
  if (task.task_kind === "checklist") {
    return { is_complete: true };
  }
  return { status: "done" };
}

/** Optimistic local shape after marking complete (before server response). */
export function applyOptimisticTaskComplete(
  task: EventTaskResponse,
): EventTaskResponse {
  const completed_at = task.completed_at ?? new Date().toISOString();
  if (task.task_kind === "checklist") {
    const checklist_items = task.checklist_items.map((item) => ({
      ...item,
      is_completed: true,
    }));
    return {
      ...task,
      checklist_items,
      is_complete: checklist_items.length > 0,
      status: "done",
      completed_at,
    };
  }
  return { ...task, is_complete: true, status: "done", completed_at };
}

export type MyTasksTab = "all" | "overdue" | "today" | "upcoming";

export type MyTasksSummary = {
  openCount: number;
  overdueCount: number;
  dueTodayCount: number;
  upcomingCount: number;
  completedTodayCount: number;
  nextTask: EventTaskResponse | null;
  overdueTask: EventTaskResponse | null;
  /** Open tasks: overdue first, then soonest due date. */
  previewTasks: EventTaskResponse[];
  overdueTasks: EventTaskResponse[];
  dueTodayTasks: EventTaskResponse[];
  upcomingTasks: EventTaskResponse[];
  completedTodayTasks: EventTaskResponse[];
};

export function filterTasksForTab(
  summary: MyTasksSummary,
  tab: MyTasksTab,
): EventTaskResponse[] {
  if (tab === "all") {
    return summary.previewTasks;
  }
  if (tab === "overdue") {
    return summary.overdueTasks;
  }
  if (tab === "today") {
    return summary.dueTodayTasks;
  }
  return summary.upcomingTasks;
}

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

function isCompletedToday(
  task: EventTaskResponse,
  now = new Date(),
): boolean {
  if (!task.is_complete || !task.completed_at) {
    return false;
  }
  return isToday(new Date(task.completed_at), now);
}

export function summarizeMyTasks(
  tasks: EventTaskResponse[],
  now = new Date(),
): MyTasksSummary {
  const open = tasks.filter((task) => !task.is_complete);
  const sortedOpen = sortOpenTasksForPreview(tasks);
  const overdueTasks = sortedOpen.filter((task) => task.is_overdue);
  const dueTodayTasks = sortedOpen.filter(
    (task) =>
      !task.is_overdue &&
      task.due_date != null &&
      isToday(new Date(task.due_date), now),
  );
  const upcomingTasks = sortedOpen.filter(
    (task) =>
      !task.is_overdue &&
      !(task.due_date != null && isToday(new Date(task.due_date), now)),
  );
  const completedTodayTasks = tasks
    .filter((task) => isCompletedToday(task, now))
    .sort((left, right) => {
      const leftAt = left.completed_at
        ? new Date(left.completed_at).getTime()
        : 0;
      const rightAt = right.completed_at
        ? new Date(right.completed_at).getTime()
        : 0;
      return rightAt - leftAt;
    });
  const withDue = open
    .filter((task) => task.due_date)
    .sort(
      (left, right) =>
        new Date(left.due_date!).getTime() - new Date(right.due_date!).getTime(),
    );

  return {
    openCount: open.length,
    overdueCount: overdueTasks.length,
    dueTodayCount: dueTodayTasks.length,
    upcomingCount: upcomingTasks.length,
    completedTodayCount: completedTodayTasks.length,
    nextTask: withDue[0] ?? open[0] ?? null,
    overdueTask: overdueTasks[0] ?? null,
    previewTasks: sortedOpen.slice(0, PREVIEW_LIMIT),
    overdueTasks,
    dueTodayTasks,
    upcomingTasks,
    completedTodayTasks,
  };
}

export function getMyTasksPath(_role: MemberRole): string {
  return "/events/tasks";
}

function greetingPartOfDay(now: Date): "morning" | "afternoon" | "evening" {
  const hour = now.getHours();
  if (hour < 12) {
    return "morning";
  }
  if (hour < 17) {
    return "afternoon";
  }
  return "evening";
}

/** One-line Home briefing under the page title. */
export type HomeGreeting = {
  /** e.g. "Good morning, Mukesh." */
  salutation: string;
  /** e.g. "3 overdue tasks." Empty string when nothing needs saying. */
  detail: string;
};

export function buildHomeGreeting(opts: {
  firstName: string;
  overdueCount: number;
  nextEventName?: string | null;
  nextEventStartsAt?: string | null;
  now?: Date;
}): HomeGreeting {
  const now = opts.now ?? new Date();
  const name = opts.firstName.trim() || "there";
  const salutation = `Good ${greetingPartOfDay(now)}, ${name}.`;

  /* Event countdown lives on the hero — greetings only call out open problems. */
  if (opts.overdueCount > 0) {
    return {
      salutation,
      detail:
        opts.overdueCount === 1
          ? "You have 1 overdue task."
          : `You have ${opts.overdueCount} overdue tasks.`,
    };
  }

  return {
    salutation,
    detail: "Here’s what’s happening with NSA today.",
  };
}

