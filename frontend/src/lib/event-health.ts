/**
 * Derive a compact overall health level for an event from prep, budget,
 * volunteers, and overdue work — used by the sidebar Event Health summary.
 */

export type EventHealthLevel =
  | "excellent"
  | "on_track"
  | "needs_attention"
  | "at_risk";

export type EventHealthAction = "volunteers" | "budget" | "tasks" | null;

export type EventHealthInput = {
  preparationPct: number;
  checklistDone: number;
  checklistTotal: number;
  overdueTasks: number;
  budgetSpent: number;
  budgetCap: number;
  volunteersFilled: number;
  volunteersNeeded: number;
  volunteersTargetSet: boolean;
};

export type EventHealthBadge = {
  level: EventHealthLevel;
  label: string;
  /** Short next-step copy when the event still has work. */
  nextMilestone: string | null;
  action: EventHealthAction;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

export function volunteerShortfall(input: EventHealthInput): number {
  if (!input.volunteersTargetSet) {
    return 0;
  }
  return Math.max(0, input.volunteersNeeded - input.volunteersFilled);
}

function checklistMilestone(done: number, total: number): string {
  const remaining = Math.max(0, total - done);
  return remaining === 1
    ? "Complete 1 checklist item"
    : `Complete ${remaining} checklist items`;
}

export function eventHealthManageHref(
  eventId: number,
  action: EventHealthAction,
): string {
  const base = `/events/${eventId}/manage`;
  if (action === "tasks") {
    return `${base}?tab=operations&modal=tasks`;
  }
  if (action === "volunteers" || action === "budget") {
    return `${base}?tab=operations`;
  }
  return base;
}

export function computeEventHealth(input: EventHealthInput): EventHealthBadge {
  const prep = clampPercent(input.preparationPct);
  const budgetOverspent =
    input.budgetCap > 0 && input.budgetSpent > input.budgetCap;
  const shortfall = volunteerShortfall(input);
  const hasChecklist = input.checklistTotal > 0;

  if (input.overdueTasks > 0) {
    return {
      level: "at_risk",
      label: "At Risk",
      nextMilestone:
        input.overdueTasks === 1
          ? "Review 1 overdue task"
          : `Review ${input.overdueTasks} overdue tasks`,
      action: "tasks",
    };
  }

  if (budgetOverspent) {
    return {
      level: "at_risk",
      label: "At Risk",
      nextMilestone: "Review budget",
      action: "budget",
    };
  }

  if (!input.volunteersTargetSet || shortfall > 0 || (hasChecklist && prep < 50)) {
    if (!input.volunteersTargetSet) {
      return {
        level: "needs_attention",
        label: "Needs Attention",
        nextMilestone: "Set volunteer targets",
        action: "volunteers",
      };
    }
    if (shortfall > 0) {
      return {
        level: "needs_attention",
        label: "Needs Attention",
        nextMilestone:
          shortfall === 1
            ? "Assign 1 volunteer"
            : `Assign ${shortfall} volunteers`,
        action: "volunteers",
      };
    }
    return {
      level: "needs_attention",
      label: "Needs Attention",
      nextMilestone: checklistMilestone(input.checklistDone, input.checklistTotal),
      action: "tasks",
    };
  }

  if (
    (!hasChecklist || prep >= 90) &&
    (input.volunteersTargetSet
      ? shortfall === 0 && input.volunteersNeeded > 0
      : true)
  ) {
    return {
      level: "excellent",
      label: "Excellent",
      nextMilestone: null,
      action: null,
    };
  }

  if (hasChecklist && prep < 90) {
    const remaining = Math.max(0, input.checklistTotal - input.checklistDone);
    if (remaining > 0) {
      return {
        level: "on_track",
        label: "On Track",
        nextMilestone: checklistMilestone(input.checklistDone, input.checklistTotal),
        action: "tasks",
      };
    }
  }

  return {
    level: "on_track",
    label: "On Track",
    nextMilestone: null,
    action: null,
  };
}
