import { Link } from "react-router-dom";

import { FINANCE_APPROVALS_PATH } from "../lib/finance-routes";

type HomeFinanceQuickActionsProps = {
  pendingApprovalCount: number;
  onLogTransaction: () => void;
};

export function HomeFinanceQuickActions({
  pendingApprovalCount,
  onLogTransaction,
}: HomeFinanceQuickActionsProps) {
  return (
    <nav
      aria-label="Finance quick actions"
      className="flex flex-wrap items-center gap-3"
    >
      <button
        type="button"
        onClick={onLogTransaction}
        className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
      >
        + Log transaction
      </button>

      <Link
        to={FINANCE_APPROVALS_PATH}
        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-surface-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:bg-accent/5"
      >
        Review approvals
        {pendingApprovalCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-overdue px-1.5 text-xs font-semibold text-white">
            {pendingApprovalCount}
          </span>
        ) : null}
      </Link>
    </nav>
  );
}
