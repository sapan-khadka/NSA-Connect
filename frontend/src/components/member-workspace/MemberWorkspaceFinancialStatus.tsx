/**
 * Financial Status — compact dues snapshot for Member Workspace.
 * No reimbursements (not in schema). Lifetime = sum of amount_paid from history API.
 */

import { Check, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import type { FinancialStatusSummary } from "../../lib/member-workspace-financial";
import { AppIcon } from "../ui/AppIcon";

type MemberWorkspaceFinancialStatusProps = {
  summary: FinancialStatusSummary | null;
  isLoading?: boolean;
  /** When the viewer cannot load dues for this member. */
  unavailable?: boolean;
  financePath?: string;
  /** Optional last payment milestone (from activity / dues history). */
  lastPaymentLabel?: string | null;
};

function FinancialEmpty() {
  return <p className="member-workspace-empty-inline">No dues on record.</p>;
}

function FinancialUnavailable() {
  return (
    <p className="member-workspace-empty-inline">Financial details unavailable.</p>
  );
}

function CurrentDuesValue({ summary }: { summary: FinancialStatusSummary }) {
  if (summary.currentTone === "paid") {
    return (
      <span className="member-workspace-finance-value member-workspace-finance-value--paid">
        <AppIcon icon={Check} size="xs" className="text-current" />
        Paid
      </span>
    );
  }

  return (
    <span
      className={`member-workspace-finance-value member-workspace-finance-value--${summary.currentTone}`}
    >
      {summary.outstandingLabel ?? summary.currentStatusLabel}
    </span>
  );
}

export function MemberWorkspaceFinancialStatus({
  summary,
  isLoading = false,
  unavailable = false,
  financePath = "/finance?tab=dues",
  lastPaymentLabel = null,
}: MemberWorkspaceFinancialStatusProps) {
  return (
    <section
      className="member-workspace-card member-workspace-card--default member-workspace-finance"
      aria-label="Financial Status"
    >
      <div className="member-workspace-card-header member-workspace-resp-header">
        <div className="member-workspace-card-heading">
          <span className="member-workspace-card-icon" aria-hidden="true">
            <AppIcon icon={Wallet} size="sm" className="text-current" />
          </span>
          <div className="min-w-0">
            <h2 className="member-workspace-card-title">Financial Status</h2>
          </div>
        </div>
        <Link to={financePath} className="member-workspace-resp-view-all">
          View all
        </Link>
      </div>

      <div className="member-workspace-card-body member-workspace-resp-body">
        {isLoading ? (
          <p className="member-workspace-resp-loading">Loading financial status…</p>
        ) : null}

        {!isLoading && unavailable ? <FinancialUnavailable /> : null}

        {!isLoading && !unavailable && summary && !summary.hasHistory ? (
          <FinancialEmpty />
        ) : null}

        {!isLoading && !unavailable && summary?.hasHistory ? (
          <dl className="member-workspace-finance-rows">
            <div className="member-workspace-finance-row">
              <dd>
                <CurrentDuesValue summary={summary} />
              </dd>
              <dt>Current dues</dt>
            </div>
            <div className="member-workspace-finance-row">
              <dd>
                <span className="member-workspace-finance-value tabular-nums">
                  {summary.lifetimeLabel ?? "—"}
                </span>
              </dd>
              <dt>Lifetime contributions</dt>
            </div>
            {lastPaymentLabel ? (
              <div className="member-workspace-finance-row">
                <dd>
                  <span className="member-workspace-finance-value">
                    {lastPaymentLabel}
                  </span>
                </dd>
                <dt>Last payment</dt>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
