/**
 * AI Insights — passive list of deterministic rule results (not generative AI).
 */

import { Sparkles } from "lucide-react";

import type { WorkspaceInsight } from "../../lib/member-workspace-insights";
import { AppIcon } from "../ui/AppIcon";

type MemberWorkspaceInsightsProps = {
  insights: WorkspaceInsight[];
  isLoading?: boolean;
};

function InsightsEmpty() {
  return (
    <div className="member-workspace-resp-empty">
      <p className="member-workspace-resp-empty-title">
        No notable patterns right now.
      </p>
      <p className="member-workspace-insights-empty-desc">
        Nothing matched the current insight rules for this member.
      </p>
    </div>
  );
}

export function MemberWorkspaceInsights({
  insights,
  isLoading = false,
}: MemberWorkspaceInsightsProps) {
  return (
    <section
      className="member-workspace-card member-workspace-card--default member-workspace-insights"
      aria-label="AI Insights"
    >
      <div className="member-workspace-card-header member-workspace-resp-header">
        <div className="member-workspace-card-heading">
          <span className="member-workspace-card-icon" aria-hidden="true">
            <AppIcon icon={Sparkles} size="sm" className="text-current" />
          </span>
          <div className="min-w-0">
            <h2 className="member-workspace-card-title">AI Insights</h2>
            <p className="member-workspace-card-desc">
              Patterns from attendance, dues, and tasks.
            </p>
          </div>
        </div>
      </div>

      <div className="member-workspace-card-body member-workspace-resp-body">
        {isLoading ? (
          <p className="member-workspace-resp-loading">Loading insights…</p>
        ) : null}

        {!isLoading && insights.length === 0 ? <InsightsEmpty /> : null}

        {!isLoading && insights.length > 0 ? (
          <ul className="member-workspace-insights-list">
            {insights.map((insight) => (
              <li
                key={insight.id}
                className={`member-workspace-insights-item member-workspace-insights-item--${insight.tone}`}
              >
                <span
                  className="member-workspace-insights-icon"
                  aria-hidden="true"
                >
                  <AppIcon icon={insight.icon} size="sm" className="text-current" />
                </span>
                <p className="member-workspace-insights-message">
                  {insight.message}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
