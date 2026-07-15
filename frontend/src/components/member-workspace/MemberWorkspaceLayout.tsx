/**
 * Member Workspace layout shell — Linear / GitHub / Stripe / Notion inspired.
 * Spacing, hierarchy, and responsive grid only. Section slots can replace placeholders.
 */

import type { ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Sparkles,
  StickyNote,
  Wallet,
} from "lucide-react";

import { MemberWorkspacePlaceholderCard } from "./MemberWorkspacePlaceholderCard";

type MemberWorkspaceLayoutProps = {
  /** Workspace header (identity, back nav, badges). */
  header: ReactNode;
  /**
   * Section directly under the header (Today's Snapshot).
   * When omitted, nothing is rendered between header and the content grid.
   */
  overview?: ReactNode;
  /**
   * Replaces the Tasks placeholder in the primary column.
   * When omitted, the Tasks placeholder card is shown.
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
   * Rendered directly under Recent Activity (replaces Payments placeholder).
   */
  financialStatus?: ReactNode;
  /**
   * Rendered in the aside directly under Private Notes (replaces Documents placeholder).
   */
  documents?: ReactNode;
  /**
   * Final aside section (replaces AI Insights placeholder).
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
  documents,
  insights,
}: MemberWorkspaceLayoutProps) {
  return (
    <div className="member-workspace">
      <div className="member-workspace-shell">
        <header className="member-workspace-header">{header}</header>

        {overview}

        <div className="member-workspace-grid" aria-label="Member workspace">
          {/* Primary column — spans 7 on desktop, 6 on tablet, full on mobile */}
          <div className="member-workspace-main">
            <MemberWorkspacePlaceholderCard
              title="Overview"
              description="Profile summary, talents, and contact."
              icon={LayoutDashboard}
              density="tall"
            />
            <MemberWorkspacePlaceholderCard
              title="Attendance"
              description="Recent event attendance and trends."
              icon={CalendarDays}
              density="default"
            />
            {responsibilities ?? (
              <MemberWorkspacePlaceholderCard
                title="Tasks"
                description="Assigned and completed work."
                density="default"
              />
            )}
            {schedule}
            {recentActivity ?? (
              <MemberWorkspacePlaceholderCard
                title="Activity Timeline"
                description="Latest member activity."
                icon={Activity}
                density="tall"
              />
            )}
            {financialStatus ?? (
              <MemberWorkspacePlaceholderCard
                title="Payments"
                description="Dues status and payment history."
                icon={Wallet}
                density="default"
              />
            )}
            <MemberWorkspacePlaceholderCard
              title="Upcoming Events"
              description="Events this member is involved in."
              icon={CalendarDays}
              density="compact"
            />
          </div>

          {/* Secondary column — spans 5 on desktop, 6 on tablet, full on mobile */}
          <aside className="member-workspace-aside" aria-label="Sidebar">
            <MemberWorkspacePlaceholderCard
              title="Health"
              description="Engagement and standing signals."
              icon={HeartPulse}
              density="default"
            />
            <MemberWorkspacePlaceholderCard
              title="Notes"
              description="Private officer notes."
              icon={StickyNote}
              density="compact"
            />
            {documents ?? (
              <MemberWorkspacePlaceholderCard
                title="Documents"
                description="Files linked to this member."
                icon={FileText}
                density="compact"
              />
            )}
            {insights ?? (
              <MemberWorkspacePlaceholderCard
                title="AI Insights"
                description="Suggested actions and patterns."
                icon={Sparkles}
                density="default"
              />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
