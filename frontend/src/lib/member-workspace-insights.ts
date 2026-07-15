/**
 * Deterministic Member Workspace insights — rule templates only, no LLM.
 * Only the four v1 rules below; if a condition is not met, the insight is omitted.
 */

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  CircleDollarSign,
} from "lucide-react";

import type { EventTaskResponse } from "./event-tasks-api";
import { formatCurrency } from "./format-currency";
import type { FinancialStatusSummary } from "./member-workspace-financial";

export type WorkspaceInsightId =
  | "missed_meetings"
  | "outstanding_dues"
  | "high_task_completion"
  | "overdue_task";

export type WorkspaceInsightTone = "attention" | "risk" | "positive";

export type WorkspaceInsight = {
  id: WorkspaceInsightId;
  tone: WorkspaceInsightTone;
  message: string;
  icon: LucideIcon;
};

export type BuildWorkspaceInsightsInput = {
  /** Trailing consecutive ABSENT meeting roll-call marks; null if unavailable. */
  consecutiveMissedMeetings: number | null;
  /** Current-semester financial summary; null if viewer cannot load dues. */
  financialSummary: FinancialStatusSummary | null;
  /** Assigned tasks for the subject when available to the viewer. */
  tasks: EventTaskResponse[];
  /** Clock for tests; defaults to now. */
  now?: Date;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TASK_WINDOW_DAYS = 90;
const MIN_ASSIGNED_FOR_COMPLETION = 3;
const COMPLETION_THRESHOLD = 0.9;
const OVERDUE_MIN_DAYS = 7;
const MISSED_MEETINGS_THRESHOLD = 3;

export function countTasksInLastDays(
  tasks: EventTaskResponse[],
  days: number,
  now: Date,
): { assigned: number; completed: number } {
  const cutoff = now.getTime() - days * MS_PER_DAY;
  let assigned = 0;
  let completed = 0;
  for (const task of tasks) {
    const created = new Date(task.created_at).getTime();
    if (!Number.isFinite(created) || created < cutoff) {
      continue;
    }
    assigned += 1;
    if (task.is_complete || task.status === "done") {
      completed += 1;
    }
  }
  return { assigned, completed };
}

/** Most overdue open task by 7+ days, or null. */
export function findTaskOverdueByDays(
  tasks: EventTaskResponse[],
  minDays: number,
  now: Date,
): EventTaskResponse | null {
  const nowMs = now.getTime();
  let best: EventTaskResponse | null = null;
  let bestOverdueMs = 0;

  for (const task of tasks) {
    if (task.is_complete || task.status === "done" || !task.due_date) {
      continue;
    }
    const dueMs = new Date(task.due_date).getTime();
    if (!Number.isFinite(dueMs)) {
      continue;
    }
    const overdueMs = nowMs - dueMs;
    if (overdueMs < minDays * MS_PER_DAY) {
      continue;
    }
    if (overdueMs > bestOverdueMs) {
      bestOverdueMs = overdueMs;
      best = task;
    }
  }
  return best;
}

/**
 * Apply fixed v1 insight rules in product order. No subjective copy.
 *
 * Outstanding dues wording omits eligibility claims — the codebase has no
 * dues→RSVP/registration gate (verified against rsvp_service and event APIs).
 */
export function buildMemberWorkspaceInsights(
  input: BuildWorkspaceInsightsInput,
): WorkspaceInsight[] {
  const now = input.now ?? new Date();
  const insights: WorkspaceInsight[] = [];

  const missed = input.consecutiveMissedMeetings;
  if (missed !== null && missed >= MISSED_MEETINGS_THRESHOLD) {
    insights.push({
      id: "missed_meetings",
      tone: "attention",
      message: `Hasn't attended the last ${missed} meetings.`,
      icon: CalendarOff,
    });
  }

  const financial = input.financialSummary;
  if (
    financial &&
    financial.hasHistory &&
    financial.currentStatus === "unpaid" &&
    financial.outstandingAmount !== null &&
    financial.outstandingAmount > 0
  ) {
    insights.push({
      id: "outstanding_dues",
      tone: "risk",
      message: `Outstanding dues (${formatCurrency(financial.outstandingAmount)}).`,
      icon: CircleDollarSign,
    });
  }

  const { assigned, completed } = countTasksInLastDays(
    input.tasks,
    TASK_WINDOW_DAYS,
    now,
  );
  if (
    assigned >= MIN_ASSIGNED_FOR_COMPLETION &&
    completed / assigned >= COMPLETION_THRESHOLD
  ) {
    insights.push({
      id: "high_task_completion",
      tone: "positive",
      message: "Consistently completes assigned responsibilities.",
      icon: CheckCircle2,
    });
  }

  const overdueTask = findTaskOverdueByDays(
    input.tasks,
    OVERDUE_MIN_DAYS,
    now,
  );
  if (overdueTask) {
    const title = overdueTask.title.trim() || "Untitled task";
    insights.push({
      id: "overdue_task",
      tone: "attention",
      message: `Has an overdue responsibility: '${title}'.`,
      icon: AlertTriangle,
    });
  }

  return insights;
}
