/**
 * Derive a compact overall health level for an event from prep, budget,
 * volunteers, and overdue work — used by the sidebar Event Health summary.
 */

export type EventHealthLevel =
  | "excellent"
  | "on_track"
  | "needs_attention"
  | "at_risk";

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
  /** Short next-step copy when the event is healthy enough to suggest work. */
  nextMilestone: string | null;
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

export function computeEventHealth(input: EventHealthInput): EventHealthBadge {
  const prep = clampPercent(input.preparationPct);
  const budgetOverspent =
    input.budgetCap > 0 && input.budgetSpent > input.budgetCap;
  const shortfall = volunteerShortfall(input);
  const hasChecklist = input.checklistTotal > 0;

  if (input.overdueTasks > 0 || budgetOverspent) {
    return {
      level: "at_risk",
      label: "At Risk",
      nextMilestone: null,
    };
  }

  if (!input.volunteersTargetSet || shortfall > 0 || (hasChecklist && prep < 50)) {
    let nextMilestone: string | null = null;
    if (!input.volunteersTargetSet) {
      nextMilestone = "Set volunteer targets";
    } else if (shortfall > 0) {
      nextMilestone =
        shortfall === 1
          ? "Assign 1 volunteer"
          : `Assign ${shortfall} volunteers`;
    } else if (hasChecklist && prep < 50) {
      const remaining = Math.max(0, input.checklistTotal - input.checklistDone);
      nextMilestone =
        remaining === 1
          ? "Complete 1 checklist item"
          : `Complete ${remaining} checklist items`;
    }
    return {
      level: "needs_attention",
      label: "Needs Attention",
      nextMilestone,
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
    };
  }

  let nextMilestone: string | null = null;
  if (hasChecklist && prep < 90) {
    const remaining = Math.max(0, input.checklistTotal - input.checklistDone);
    if (remaining > 0) {
      nextMilestone =
        remaining === 1
          ? "Complete 1 checklist item"
          : `Complete ${remaining} checklist items`;
    }
  }

  return {
    level: "on_track",
    label: "On Track",
    nextMilestone,
  };
}
