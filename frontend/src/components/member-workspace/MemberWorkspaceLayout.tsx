/**
 * Member Workspace layout shell — Linear / GitHub / Stripe / Notion inspired.
 * Only renders real section slots; no hollow “coming soon” placeholders.
 */

import type { ReactNode } from "react";

type MemberWorkspaceLayoutProps = {
  /** Workspace header (identity, back nav, badges). */
  header: ReactNode;
  /**
   * Section directly under the header (Today's Snapshot).
   * When omitted, nothing is rendered between header and the content grid.
   */
  overview?: ReactNode;
  /**
   * Primary-column responsibilities / tasks section.
   */
  responsibilities?: ReactNode;
  /**
   * Rendered directly under Current Responsibilities / Tasks.
   */
  schedule?: ReactNode;
  /**
   * Rendered directly under Upcoming Schedule.
   */
  recentActivity?: ReactNode;
  /**
   * Rendered directly under Recent Activity.
   */
  financialStatus?: ReactNode;
  /**
   * Officer-only Private Notes. When omitted (general members), nothing is
   * rendered — no placeholder, empty state, or locked card.
   */
  privateNotes?: ReactNode;
  /**
   * Rendered in the aside directly under Private Notes.
   */
  documents?: ReactNode;
  /**
   * Final aside section.
   */
  insights?: ReactNode;
};

export function MemberWorkspaceLayout({
  header,
  overview,
  responsibilities,
  schedule,
  recentActivity,
  financialStatus,
  privateNotes,
  documents,
  insights,
}: MemberWorkspaceLayoutProps) {
  const hasMain =
    Boolean(responsibilities) ||
    Boolean(schedule) ||
    Boolean(recentActivity) ||
    Boolean(financialStatus);
  const hasAside =
    Boolean(privateNotes) || Boolean(documents) || Boolean(insights);

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
                {schedule}
                {recentActivity}
                {financialStatus}
              </div>
            ) : null}

            {hasAside ? (
              <aside className="member-workspace-aside" aria-label="Sidebar">
                {privateNotes}
                {documents}
                {insights}
              </aside>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
