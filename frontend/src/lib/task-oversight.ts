import type { EventTaskResponse, TaskOverviewMember } from "./event-tasks-api";
import { isMemberRole, isRoleAtLeast, type MemberRole } from "./roles";

export type ActiveAssignmentsSort =
  | "incomplete_first"
  | "alphabetical"
  | "completion_desc";

export type AssigneeCategoryFilter = "all" | "board" | "general" | "volunteers";

export const ACTIVE_ASSIGNMENTS_SORT_OPTIONS: {
  value: ActiveAssignmentsSort;
  label: string;
}[] = [
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
  const in_progress = tasks.filter((task) => task.status === "in_progress").length;
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

export function countOverdueTasks(members: TaskOverviewMember[]): number {
  return members.reduce(
    (sum, row) => sum + row.tasks.filter(isOverdueOpenTask).length,
    0,
  );
}

export function countMemberOverdueTasks(member: TaskOverviewMember): number {
  return member.tasks.filter(isOverdueOpenTask).length;
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

export function sortActiveMembers(
  members: TaskOverviewMember[],
  sort: ActiveAssignmentsSort,
): TaskOverviewMember[] {
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
