import { Link } from "react-router-dom";

import type { MyTasksSummary } from "../../lib/home-tasks";
import { FINANCE_APPROVALS_PATH } from "../../lib/finance-routes";

export type UrgencyChip = {
  id: string;
  /** Numeric emphasis shown beside the label when present. */
  count?: number;
  label: string;
  to: string;
  tone: "urgent" | "warn" | "info";
};

export function buildHomeUrgencyChips({
  tasksSummary,
  tasksPath,
  pendingMemberApprovals,
  financePendingCount,
  canReviewMembers,
  canReviewFinance,
  notesNeededPath = null,
}: {
  tasksSummary: MyTasksSummary;
  tasksPath: string;
  pendingMemberApprovals: number;
  financePendingCount: number;
  canReviewMembers: boolean;
  canReviewFinance: boolean;
  /** Deep link when a board meeting still needs minutes. */
  notesNeededPath?: string | null;
}): UrgencyChip[] {
  const chips: UrgencyChip[] = [];

  if (tasksSummary.overdueCount > 0) {
    chips.push({
      id: "overdue",
      count: tasksSummary.overdueCount,
      label: "overdue",
      to: tasksPath,
      tone: "urgent",
    });
  }
  if (tasksSummary.dueTodayCount > 0) {
    chips.push({
      id: "due-today",
      count: tasksSummary.dueTodayCount,
      label: "due today",
      to: tasksPath,
      tone: "warn",
    });
  }

  const memberReviews = canReviewMembers ? pendingMemberApprovals : 0;
  const financeReviews = canReviewFinance ? financePendingCount : 0;
  const reviewTotal = memberReviews + financeReviews;

  if (reviewTotal > 0) {
    chips.push({
      id: "reviews",
      count: reviewTotal,
      label: reviewTotal === 1 ? "review" : "reviews",
      to:
        memberReviews > 0 ? "/members?tab=pending" : FINANCE_APPROVALS_PATH,
      tone: "warn",
    });
  }

  if (notesNeededPath) {
    chips.push({
      id: "notes-needed",
      label: "Notes needed",
      to: notesNeededPath,
      tone: "info",
    });
  }

  return chips;
}

const TONE_CLASS: Record<UrgencyChip["tone"], string> = {
  urgent:
    "border-rose-200/80 bg-rose-50/90 text-rose-900 hover:border-rose-300 hover:bg-rose-100/90",
  warn: "border-amber-200/80 bg-amber-50/90 text-amber-950 hover:border-amber-300 hover:bg-amber-100/80",
  info: "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
};

export function HomeUrgencyChips({ chips }: { chips: UrgencyChip[] }) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" aria-label="Needs attention">
      <p className="home-section-title">Needs attention</p>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.id}>
            <Link
              to={chip.to}
              className={["home-metric-pill", TONE_CLASS[chip.tone]].join(" ")}
            >
              {chip.count != null ? (
                <>
                  <span className="home-metric-count">{chip.count}</span>
                  {" "}
                  <span>{chip.label}</span>
                </>
              ) : (
                <span>{chip.label}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
