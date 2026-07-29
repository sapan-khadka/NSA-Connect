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

export function MemberWorkspaceInsights({
  insights,
  isLoading = false,
}: MemberWorkspaceInsightsProps) {
  if (!isLoading && insights.length === 0) {
    return null;
  }

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
          </div>
        </div>
      </div>

      <div className="member-workspace-card-body member-workspace-resp-body">
        {isLoading ? (
          <p className="member-workspace-resp-loading">Loading insights…</p>
        ) : null}

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
