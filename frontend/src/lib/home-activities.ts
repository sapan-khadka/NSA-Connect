import type { MyTasksSummary } from "./home-tasks";
import { getMyTasksPath } from "./home-tasks";
import { FINANCE_APPROVALS_PATH } from "./finance-routes";
import type { MemberRole } from "./roles";

export type ActivityTone = "urgent" | "info";

export type ActivityKind = "actionable" | "recent";

export const HOME_ACTIVITY_RECENT_WINDOW_DAYS = 7;

export const RECENT_ACTIVITY_FOOTNOTE = `Recent · clears from this feed after ${HOME_ACTIVITY_RECENT_WINDOW_DAYS} days`;

export type HomeActivity = {
  id: string;
  message: string;
  to: string;
  actionLabel: string;
  tone: ActivityTone;
  kind: ActivityKind;
};

export function sortHomeActivities(activities: HomeActivity[]): HomeActivity[] {
  const actionable = activities.filter((activity) => activity.kind === "actionable");
  const recent = activities.filter((activity) => activity.kind === "recent");
  return [...actionable, ...recent];
}

type BuildActivitiesInput = {
  role: MemberRole;
  tasksSummary: MyTasksSummary;
  pendingMembersTotal: number;
  financePendingTotal: number;
  myFinanceRequests: {
    pending_count: number;
    recently_rejected_count: number;
    recently_approved_count: number;
  } | null;
};

export function buildHomeActivities({
  role,
  tasksSummary,
  pendingMembersTotal,
  financePendingTotal,
  myFinanceRequests,
}: BuildActivitiesInput): HomeActivity[] {
  const activities: HomeActivity[] = [];

  if (tasksSummary.overdueCount > 0) {
    activities.push({
      id: "overdue-tasks",
      message: `${tasksSummary.overdueCount} assigned task${tasksSummary.overdueCount === 1 ? "" : "s"} past due`,
      to: getMyTasksPath(role),
      actionLabel: "Review",
      tone: "urgent",
      kind: "actionable",
    });
  }

  if (pendingMembersTotal > 0) {
    activities.push({
      id: "pending-members",
      message: `${pendingMembersTotal} member signup${pendingMembersTotal === 1 ? "" : "s"} waiting for approval`,
      to: "/members?tab=pending",
      actionLabel: "Review",
      tone: "urgent",
      kind: "actionable",
    });
  }

  if (financePendingTotal > 0) {
    activities.push({
      id: "finance-pending",
      message: `${financePendingTotal} finance change request${financePendingTotal === 1 ? "" : "s"} need your review`,
      to: FINANCE_APPROVALS_PATH,
      actionLabel: "Review",
      tone: "urgent",
      kind: "actionable",
    });
  }

  if (myFinanceRequests && myFinanceRequests.pending_count > 0) {
    activities.push({
      id: "finance-my-pending",
      message: `${myFinanceRequests.pending_count} of your finance request${myFinanceRequests.pending_count === 1 ? "" : "s"} awaiting approval`,
      to: FINANCE_APPROVALS_PATH,
      actionLabel: "View",
      tone: "urgent",
      kind: "actionable",
    });
  }

  if (myFinanceRequests && myFinanceRequests.recently_rejected_count > 0) {
    activities.push({
      id: "finance-my-rejected",
      message: `${myFinanceRequests.recently_rejected_count} finance request${myFinanceRequests.recently_rejected_count === 1 ? "" : "s"} rejected this week`,
      to: FINANCE_APPROVALS_PATH,
      actionLabel: "Review",
      tone: "info",
      kind: "recent",
    });
  }

  if (myFinanceRequests && myFinanceRequests.recently_approved_count > 0) {
    activities.push({
      id: "finance-my-approved",
      message: `${myFinanceRequests.recently_approved_count} finance request${myFinanceRequests.recently_approved_count === 1 ? "" : "s"} approved this week`,
      to: FINANCE_APPROVALS_PATH,
      actionLabel: "View",
      tone: "info",
      kind: "recent",
    });
  }

  return sortHomeActivities(activities);
}
