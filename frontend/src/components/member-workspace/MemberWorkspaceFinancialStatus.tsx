/**
 * Financial Status — compact dues snapshot for Member Workspace.
 * No reimbursements (not in schema). Lifetime = sum of amount_paid from history API.
 */

import { Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import type { FinancialStatusSummary } from "../../lib/member-workspace-financial";
import { AppIcon } from "../ui/AppIcon";

type MemberWorkspaceFinancialStatusProps = {
  summary: FinancialStatusSummary | null;
  isLoading?: boolean;
  /** When the viewer cannot load dues for this member. */
  unavailable?: boolean;
  financePath?: string;
};

function FinancialEmpty() {
  return (
    <div className="member-workspace-resp-empty">
      <p className="member-workspace-resp-empty-title">No dues on record yet.</p>
      <p className="member-workspace-finance-empty-desc">
        This member has no dues history across semesters.
      </p>
    </div>
  );
}

function FinancialUnavailable() {
  return (
    <div className="member-workspace-resp-empty">
      <p className="member-workspace-resp-empty-title">Financial details unavailable</p>
      <p className="member-workspace-finance-empty-desc">
        Dues history for other members is limited to treasury access.
      </p>
    </div>
  );
}

export function MemberWorkspaceFinancialStatus({
  summary,
  isLoading = false,
  unavailable = false,
  financePath = "/finance?tab=dues",
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
            <p className="member-workspace-card-desc">
              Dues standing and lifetime contributions.
            </p>
          </div>
        </div>
        <Link to={financePath} className="member-workspace-resp-view-all">
          View all
          <span aria-hidden="true"> →</span>
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
          <dl className="member-workspace-finance-grid">
            <div className="member-workspace-finance-stat">
              <dt>Current dues</dt>
              <dd
                className={`member-workspace-finance-value member-workspace-finance-value--${summary.currentTone}`}
              >
                {summary.outstandingLabel ?? summary.currentStatusLabel}
              </dd>
              <p className="member-workspace-finance-meta">
                {summary.currentSemester}
              </p>
            </div>
            <div className="member-workspace-finance-stat">
              <dt>Lifetime contributions</dt>
              <dd className="member-workspace-finance-value">
                {summary.lifetimeLabel ?? "—"}
              </dd>
              <p className="member-workspace-finance-meta">All paid dues</p>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
