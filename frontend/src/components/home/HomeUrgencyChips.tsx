import { Link } from "react-router-dom";

import type { MyTasksSummary } from "../../lib/home-tasks";
import { FINANCE_APPROVALS_PATH } from "../../lib/finance-routes";

export type UrgencyChip = {
  id: string;
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
}: {
  tasksSummary: MyTasksSummary;
  tasksPath: string;
  pendingMemberApprovals: number;
  financePendingCount: number;
  canReviewMembers: boolean;
  canReviewFinance: boolean;
}): UrgencyChip[] {
  const chips: UrgencyChip[] = [];

  if (tasksSummary.overdueCount > 0) {
    chips.push({
      id: "overdue",
      label: `${tasksSummary.overdueCount} overdue`,
      to: tasksPath,
      tone: "urgent",
    });
  }
  if (tasksSummary.dueTodayCount > 0) {
    chips.push({
      id: "due-today",
      label: `${tasksSummary.dueTodayCount} due today`,
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
      label: `${reviewTotal} review${reviewTotal === 1 ? "" : "s"}`,
      to:
        memberReviews > 0 ? "/members?tab=pending" : FINANCE_APPROVALS_PATH,
      tone: "warn",
    });
  }

  return chips;
}

const TONE_CLASS: Record<UrgencyChip["tone"], string> = {
  urgent: "bg-rose-50 text-rose-800 ring-rose-100 hover:bg-rose-100/80",
  warn: "bg-amber-50 text-amber-900 ring-amber-100 hover:bg-amber-100/70",
  info: "bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200/70",
};

export function HomeUrgencyChips({ chips }: { chips: UrgencyChip[] }) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Needs attention">
      {chips.map((chip) => (
        <li key={chip.id}>
          <Link
            to={chip.to}
            className={[
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition",
              TONE_CLASS[chip.tone],
            ].join(" ")}
          >
            {chip.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
