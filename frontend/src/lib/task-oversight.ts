import type { EventTaskResponse, TaskOverviewMember } from "./event-tasks-api";
import { isMemberRole, isRoleAtLeast, type MemberRole } from "./roles";

export type ActiveAssignmentsSort =
  | "status"
  | "incomplete_first"
  | "alphabetical"
  | "completion_desc";

export type AssigneeCategoryFilter = "all" | "board" | "general" | "volunteers";

/** People-first health status for Task Oversight cards. */
export type OversightHealthStatus =
  | "overdue"
  | "at_risk"
  | "on_track"
  | "completed"
  | "no_data";

export type OversightWorkloadLevel =
  | "low"
  | "medium"
  | "high"
  | "overloaded";

export type OversightMemberSnapshot = {
  member: TaskOverviewMember;
  status: OversightHealthStatus;
  workload: OversightWorkloadLevel;
  activeTaskCount: number;
  overdueTaskCount: number;
  doneTaskCount: number;
  /** Non-done, not overdue. */
  activeNonOverdueCount: number;
  /** Spec: completion among assigned tasks (done / total). */
  completionPercent: number;
  nextDueTask: EventTaskResponse | null;
};

export const ACTIVE_ASSIGNMENTS_SORT_OPTIONS: {
  value: ActiveAssignmentsSort;
  label: string;
}[] = [
  { value: "status", label: "Status (default)" },
  { value: "incomplete_first", label: "Incomplete first" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "completion_desc", label: "Completion % (high to low)" },
];

export const ASSIGNEE_CATEGORY_FILTER_OPTIONS: {
  value: AssigneeCategoryFilter;
  label: string;
}[] = [
  { value: "all", label: "All assignees" },
  { value: "board", label: "Board members" },
  { value: "general", label: "General members" },
  { value: "volunteers", label: "Volunteers" },
];

export const OVERSIGHT_HEALTH_STATUS_ORDER: OversightHealthStatus[] = [
  "overdue",
  "at_risk",
  "on_track",
  "completed",
  "no_data",
];

export const OVERSIGHT_HEALTH_LABELS: Record<OversightHealthStatus, string> = {
  overdue: "Overdue",
  at_risk: "At Risk",
  on_track: "On Track",
  completed: "Completed",
  no_data: "No tasks",
};

export const OVERSIGHT_WORKLOAD_LABELS: Record<OversightWorkloadLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  overloaded: "Overloaded",
};

const MS_48_HOURS = 48 * 60 * 60 * 1000;

export function isBoardAssigneeRole(role: string): boolean {
  return isMemberRole(role) && isRoleAtLeast(role, "board");
}

export function taskMatchesAssigneeCategoryFilter(
  task: EventTaskResponse,
  memberRole: string,
  filter: AssigneeCategoryFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "board") {
    return isBoardAssigneeRole(memberRole);
  }

  if (filter === "general") {
    return memberRole === "general";
  }

  return task.assignee_has_volunteer_signup === true;
}

function recomputeMemberTaskStats(
  member: TaskOverviewMember,
  tasks: EventTaskResponse[],
): TaskOverviewMember {
  const completed = tasks.filter((task) => task.status === "done").length;
  const in_progress = tasks.filter(
    (task) => task.status === "in_progress",
  ).length;
  const todo = tasks.filter((task) => task.status === "todo").length;
  const total = tasks.length;

  return {
    ...member,
    tasks,
    total,
    completed,
    in_progress,
    todo,
    completion_percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export type OversightEventOption = {
  eventId: number;
  eventName: string;
  totalTasks: number;
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
};

/** Events that have at least one task in the overview, riskiest first. */
export function listOversightEvents(
  tasks: EventTaskResponse[],
): OversightEventOption[] {
  const byEvent = new Map<number, OversightEventOption>();

  for (const task of tasks) {
    const existing = byEvent.get(task.event_id);
    const open = !task.is_complete && task.status !== "done";
    const overdue = open && task.is_overdue;
    const completed = task.is_complete || task.status === "done";

    if (existing) {
      existing.totalTasks += 1;
      if (open) {
        existing.openTasks += 1;
      }
      if (overdue) {
        existing.overdueTasks += 1;
      }
      if (completed) {
        existing.completedTasks += 1;
      }
      continue;
    }

    byEvent.set(task.event_id, {
      eventId: task.event_id,
      eventName: task.event_name,
      totalTasks: 1,
      openTasks: open ? 1 : 0,
      overdueTasks: overdue ? 1 : 0,
      completedTasks: completed ? 1 : 0,
    });
  }

  return [...byEvent.values()].sort((left, right) => {
    if (right.overdueTasks !== left.overdueTasks) {
      return right.overdueTasks - left.overdueTasks;
    }
    if (right.openTasks !== left.openTasks) {
      return right.openTasks - left.openTasks;
    }
    return left.eventName.localeCompare(right.eventName);
  });
}

export function filterOverviewMembersByEvent(
  members: TaskOverviewMember[],
  eventId: number,
): TaskOverviewMember[] {
  return members
    .map((member) => {
      const tasks = member.tasks.filter((task) => task.event_id === eventId);
      if (tasks.length === 0) {
        return null;
      }
      return recomputeMemberTaskStats(member, tasks);
    })
    .filter((member): member is TaskOverviewMember => member !== null);
}

export function filterOverviewMembersByAssigneeCategory(
  members: TaskOverviewMember[],
  filter: AssigneeCategoryFilter,
): TaskOverviewMember[] {
  if (filter === "all") {
    return members;
  }

  return members
    .map((member) => {
      const tasks = member.tasks.filter((task) =>
        taskMatchesAssigneeCategoryFilter(task, member.role, filter),
      );

      if (tasks.length === 0) {
        return null;
      }

      return recomputeMemberTaskStats(member, tasks);
    })
    .filter((member): member is TaskOverviewMember => member !== null);
}

export function shouldShowUnassignedBoardMembers(
  filter: AssigneeCategoryFilter,
): boolean {
  return filter === "all" || filter === "board";
}

export function isOverdueOpenTask(task: EventTaskResponse): boolean {
  return task.is_overdue && !task.is_complete;
}

export function isActiveTask(task: EventTaskResponse): boolean {
  return !task.is_complete && task.status !== "done";
}

export function countOverdueTasks(members: TaskOverviewMember[]): number {
  return members.reduce(
    (sum, row) => sum + row.tasks.filter(isOverdueOpenTask).length,
    0,
  );
}

export function countMemberOverdueTasks(member: TaskOverviewMember): number {
  return member.tasks.filter(isOverdueOpenTask).length;
}

/**
 * Due within the next 48 hours (future window). Past due is overdue, not due-soon.
 */
export function isDueWithinNext48Hours(
  task: EventTaskResponse,
  now: Date = new Date(),
): boolean {
  if (!task.due_date || !isActiveTask(task) || isOverdueOpenTask(task)) {
    return false;
  }
  const dueMs = Date.parse(task.due_date);
  if (Number.isNaN(dueMs)) {
    return false;
  }
  const nowMs = now.getTime();
  return dueMs >= nowMs && dueMs <= nowMs + MS_48_HOURS;
}

/**
 * Workload from currently active (non-done) tasks, with overdue override.
 *
 * LOW: 0–2 · MEDIUM: 3–5 · HIGH: 6–9 · OVERLOADED: 10+, OR 3+ overdue.
 */
export function classifyOversightWorkload(
  activeTaskCount: number,
  overdueTaskCount: number,
): OversightWorkloadLevel {
  if (overdueTaskCount >= 3 || activeTaskCount >= 10) {
    return "overloaded";
  }
  if (activeTaskCount >= 6) {
    return "high";
  }
  if (activeTaskCount >= 3) {
    return "medium";
  }
  return "low";
}

/**
 * Health status — exact product rules (see Task Oversight redesign).
 *
 * - COMPLETED: 100% done and total ≥ 1
 * - OVERDUE: 1+ overdue open tasks
 * - AT RISK: no overdue; (1+ due in 48h OR completion among active/open work < 50%)
 *   Completion among active work = done / (done + active non-done) = overall
 *   completion percent while open work remains.
 * - ON TRACK: no overdue, nothing due in 48h, completion ≥ 50%
 * - NO_DATA: zero assigned tasks
 */
export function classifyOversightHealthStatus(
  member: TaskOverviewMember,
  now: Date = new Date(),
): OversightHealthStatus {
  if (member.total === 0 || member.tasks.length === 0) {
    return "no_data";
  }

  const doneCount = member.tasks.filter(
    (task) => task.is_complete || task.status === "done",
  ).length;
  if (doneCount === member.tasks.length) {
    return "completed";
  }

  const overdueCount = countMemberOverdueTasks(member);
  if (overdueCount >= 1) {
    return "overdue";
  }

  const activeTasks = member.tasks.filter(isActiveTask);
  const hasDueSoon = activeTasks.some((task) =>
    isDueWithinNext48Hours(task, now),
  );
  const completionPercent =
    member.total > 0
      ? Math.round((doneCount / member.total) * 100)
      : 0;

  if (hasDueSoon || completionPercent < 50) {
    return "at_risk";
  }

  return "on_track";
}

export function findNextDueTask(
  member: TaskOverviewMember,
): EventTaskResponse | null {
  const candidates = member.tasks
    .filter(isActiveTask)
    .filter((task) => Boolean(task.due_date));

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const leftMs = Date.parse(left.due_date ?? "");
    const rightMs = Date.parse(right.due_date ?? "");
    if (Number.isNaN(leftMs) && Number.isNaN(rightMs)) {
      return 0;
    }
    if (Number.isNaN(leftMs)) {
      return 1;
    }
    if (Number.isNaN(rightMs)) {
      return -1;
    }
    return leftMs - rightMs;
  })[0] ?? null;
}

export function buildOversightMemberSnapshot(
  member: TaskOverviewMember,
  now: Date = new Date(),
): OversightMemberSnapshot {
  const doneTaskCount = member.tasks.filter(
    (task) => task.is_complete || task.status === "done",
  ).length;
  const activeTasks = member.tasks.filter(isActiveTask);
  const overdueTaskCount = activeTasks.filter(isOverdueOpenTask).length;
  const activeTaskCount = activeTasks.length;
  const activeNonOverdueCount = activeTaskCount - overdueTaskCount;
  const completionPercent =
    member.total > 0
      ? Math.round((doneTaskCount / member.total) * 100)
      : 0;

  return {
    member,
    status: classifyOversightHealthStatus(member, now),
    workload: classifyOversightWorkload(activeTaskCount, overdueTaskCount),
    activeTaskCount,
    overdueTaskCount,
    doneTaskCount,
    activeNonOverdueCount,
    completionPercent,
    nextDueTask: findNextDueTask(member),
  };
}

export function buildOversightSnapshots(
  members: TaskOverviewMember[],
  now: Date = new Date(),
): OversightMemberSnapshot[] {
  return members.map((member) => buildOversightMemberSnapshot(member, now));
}

export function countHealthStatuses(
  snapshots: OversightMemberSnapshot[],
): Record<"overdue" | "at_risk" | "on_track", number> {
  return {
    overdue: snapshots.filter((row) => row.status === "overdue").length,
    at_risk: snapshots.filter((row) => row.status === "at_risk").length,
    on_track: snapshots.filter((row) => row.status === "on_track").length,
  };
}

export function splitTaskOverviewMembers(members: TaskOverviewMember[]): {
  active: TaskOverviewMember[];
  unassigned: TaskOverviewMember[];
} {
  const active: TaskOverviewMember[] = [];
  const unassigned: TaskOverviewMember[] = [];

  for (const member of members) {
    if (member.total > 0) {
      active.push(member);
    } else {
      unassigned.push(member);
    }
  }

  return { active, unassigned };
}

function compareByStatusThenName(
  left: OversightMemberSnapshot,
  right: OversightMemberSnapshot,
): number {
  const statusDelta =
    OVERSIGHT_HEALTH_STATUS_ORDER.indexOf(left.status) -
    OVERSIGHT_HEALTH_STATUS_ORDER.indexOf(right.status);
  if (statusDelta !== 0) {
    return statusDelta;
  }
  return left.member.full_name.localeCompare(right.member.full_name);
}

export function sortOversightSnapshots(
  snapshots: OversightMemberSnapshot[],
  sort: ActiveAssignmentsSort,
): OversightMemberSnapshot[] {
  const copy = [...snapshots];

  switch (sort) {
    case "alphabetical":
      return copy.sort((left, right) =>
        left.member.full_name.localeCompare(right.member.full_name),
      );
    case "completion_desc":
      return copy.sort((left, right) => {
        if (right.completionPercent !== left.completionPercent) {
          return right.completionPercent - left.completionPercent;
        }
        return left.member.full_name.localeCompare(right.member.full_name);
      });
    case "incomplete_first":
      return copy.sort((left, right) => {
        const overdueDelta = right.overdueTaskCount - left.overdueTaskCount;
        if (overdueDelta !== 0) {
          return overdueDelta;
        }
        if (left.completionPercent !== right.completionPercent) {
          return left.completionPercent - right.completionPercent;
        }
        return left.member.full_name.localeCompare(right.member.full_name);
      });
    case "status":
    default:
      return copy.sort(compareByStatusThenName);
  }
}

/** @deprecated Prefer sortOversightSnapshots — kept for existing call sites/tests. */
export function sortActiveMembers(
  members: TaskOverviewMember[],
  sort: ActiveAssignmentsSort,
): TaskOverviewMember[] {
  if (sort === "status") {
    return sortOversightSnapshots(
      buildOversightSnapshots(members),
      "status",
    ).map((row) => row.member);
  }

  const copy = [...members];

  switch (sort) {
    case "alphabetical":
      return copy.sort((left, right) =>
        left.full_name.localeCompare(right.full_name),
      );
    case "completion_desc":
      return copy.sort((left, right) => {
        if (right.completion_percent !== left.completion_percent) {
          return right.completion_percent - left.completion_percent;
        }

        return left.full_name.localeCompare(right.full_name);
      });
    case "incomplete_first":
    default:
      return copy.sort((left, right) => {
        const overdueDelta =
          countMemberOverdueTasks(right) - countMemberOverdueTasks(left);
        if (overdueDelta !== 0) {
          return overdueDelta;
        }

        if (left.completion_percent !== right.completion_percent) {
          return left.completion_percent - right.completion_percent;
        }

        return left.full_name.localeCompare(right.full_name);
      });
  }
}

export function sortUnassignedMembers(
  members: TaskOverviewMember[],
): TaskOverviewMember[] {
  return [...members].sort((left, right) =>
    left.full_name.localeCompare(right.full_name),
  );
}

export function formatOversightDueDate(dueDate: string | null): string | null {
  if (!dueDate) {
    return null;
  }
  const parsed = Date.parse(dueDate);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(parsed));
}
