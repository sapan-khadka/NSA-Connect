/**
 * Member Workspace layout shell — Linear / GitHub / Stripe / Notion inspired.
 * Only renders real section slots; no hollow “coming soon” placeholders.
 *
 * Column order (profile-first):
 *   Main: Responsibilities → Recent Activity → Schedule
 *   Aside: Notes → Documents → Financial → Insights (when present)
 */

import type { ReactNode } from "react";

type MemberWorkspaceLayoutProps = {
  /** Workspace header (identity, back nav, badges). */
  header: ReactNode;
  /**
   * Optional section under the header (legacy overview / snapshot).
   * Prefer omitting — the table of content cards should lead.
   */
  overview?: ReactNode;
  /** Primary-column responsibilities / tasks section. */
  responsibilities?: ReactNode;
  /** Primary column — recent activity (admins care most). */
  recentActivity?: ReactNode;
  /** Primary column — upcoming schedule. */
  schedule?: ReactNode;
  /**
   * Officer-only Private Notes. When omitted (general members), nothing is
   * rendered — no placeholder, empty state, or locked card.
   */
  privateNotes?: ReactNode;
  /** Aside — documents. */
  documents?: ReactNode;
  /** Aside — financial status. */
  financialStatus?: ReactNode;
  /** Aside — AI insights (pass only when there are insights). */
  insights?: ReactNode;
};

export function MemberWorkspaceLayout({
  header,
  overview,
  responsibilities,
  recentActivity,
  schedule,
  privateNotes,
  documents,
  financialStatus,
  insights,
}: MemberWorkspaceLayoutProps) {
  const hasMain =
    Boolean(responsibilities) ||
    Boolean(recentActivity) ||
    Boolean(schedule);
  const hasAside =
    Boolean(privateNotes) ||
    Boolean(documents) ||
    Boolean(financialStatus) ||
    Boolean(insights);

  return (
    <div className="member-workspace">
      <div className="member-workspace-shell">
        <header className="member-workspace-header">{header}</header>

        {overview}

        {hasMain || hasAside ? (
          <div className="member-workspace-grid" aria-label="Member workspace">
            {hasMain ? (
              <div className="member-workspace-main">
                {responsibilities}
                {recentActivity}
                {schedule}
              </div>
            ) : null}

            {hasAside ? (
              <aside className="member-workspace-aside" aria-label="Sidebar">
                {privateNotes}
                {documents}
                {financialStatus}
                {insights}
              </aside>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
