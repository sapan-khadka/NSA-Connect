/**
 * Recent Activity — workspace section wrapping the real activity timeline.
 */

import { Activity } from "lucide-react";
import { Link } from "react-router-dom";

import type { MemberActivityItem } from "../../lib/member-activity-timeline";
import { MemberActivityTimeline } from "../MemberActivityTimeline";
import { AppIcon } from "../ui/AppIcon";

type MemberWorkspaceRecentActivityProps = {
  items: MemberActivityItem[];
  hasMore: boolean;
  isLoading?: boolean;
  viewAllPath?: string | null;
};

export function MemberWorkspaceRecentActivity({
  items,
  hasMore,
  isLoading = false,
  viewAllPath = null,
}: MemberWorkspaceRecentActivityProps) {
  return (
    <section
      className="member-workspace-card member-workspace-card--default member-workspace-recent-activity"
      aria-label="Recent Activity"
    >
      <div className="member-workspace-card-header member-workspace-resp-header">
        <div className="member-workspace-card-heading">
          <span className="member-workspace-card-icon" aria-hidden="true">
            <AppIcon icon={Activity} size="sm" className="text-current" />
          </span>
          <div className="min-w-0">
            <h2 className="member-workspace-card-title">Recent Activity</h2>
            <p className="member-workspace-card-desc">
              What this member has actually done recently.
            </p>
          </div>
        </div>
        {hasMore && viewAllPath ? (
          <Link to={viewAllPath} className="member-workspace-resp-view-all">
            View all
            <span aria-hidden="true"> →</span>
          </Link>
        ) : null}
      </div>

      <div className="member-workspace-card-body member-workspace-resp-body">
        <MemberActivityTimeline items={items} loading={isLoading} />
      </div>
    </section>
  );
}
