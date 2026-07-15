/**
 * Helpers shared by Member Workspace snapshot / former metrics wiring.
 * Display builders for the KPI strip lived here; keep task/dues utilities only.
 */

import type { MemberDuesRecord } from "./dues-api";
import type { EventTaskResponse, TaskOverviewMember } from "./event-tasks-api";
import { formatCurrency } from "./format-currency";
import { formatOutstandingDuesCell } from "./members-directory";

export function activeTaskCountFromOverviewMember(
  member: TaskOverviewMember | undefined,
): number | null {
  if (!member) {
    return null;
  }
  return member.todo + member.in_progress;
}

export function activeTaskCountFromMyTasks(
  tasks: EventTaskResponse[],
): number {
  return tasks.filter((task) => task.status !== "done").length;
}

export function outstandingDuesMetricLabel(
  record: MemberDuesRecord | undefined,
): string | null {
  if (!record) {
    return null;
  }
  if (record.status === "paid" || record.status === "exempt") {
    return "Paid";
  }
  const outstanding = formatOutstandingDuesCell(record);
  if (outstanding === null) {
    return "Paid";
  }
  return formatCurrency(outstanding);
}
