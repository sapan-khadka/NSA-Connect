import { Link } from "react-router-dom";

import { Button } from "./ui/Button";
import { FINANCE_APPROVALS_PATH } from "../lib/finance-routes";

type HomeFinanceQuickActionsProps = {
  pendingApprovalCount: number;
  onLogTransaction: () => void;
  /** When true, hide the Log transaction button (already on the welcome banner). */
  compact?: boolean;
};

export function HomeFinanceQuickActions({
  pendingApprovalCount,
  onLogTransaction,
  compact = false,
}: HomeFinanceQuickActionsProps) {
  return (
    <nav
      aria-label="Finance quick actions"
      className="flex flex-wrap items-center gap-3"
    >
      {!compact ? (
        <Button type="button" onClick={onLogTransaction}>
          + Log transaction
        </Button>
      ) : null}

      <Link
        to={FINANCE_APPROVALS_PATH}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gray-200 bg-surface-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition duration-200 hover:border-primary/40 hover:bg-badge-teal-bg"
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
