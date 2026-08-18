/**
 * AI Insights card — unavailable until a real model is wired.
 * Does not invent attendance, dues, or engagement claims.
 */

import { Sparkles } from "lucide-react";

import { AppIcon } from "./ui/AppIcon";
import {
  UNAVAILABLE_MEMBER_AI_INSIGHTS,
  memberInsightToneLabel,
  type MemberAiInsightsSnapshot,
  type MemberInsight,
} from "../lib/member-ai-insights";

type MemberAiInsightsCardProps = {
  /** Override snapshot for tests or future real data. */
  snapshot?: MemberAiInsightsSnapshot;
  /** Hide the internal title when wrapped in a titled ProfileSection. */
  embedded?: boolean;
};

function InsightRow({ insight }: { insight: MemberInsight }) {
  return (
    <li className={`member-ai-insight member-ai-insight--${insight.tone}`}>
      <span className="member-ai-insight-icon" aria-hidden="true">
        <AppIcon icon={insight.icon} size="sm" className="text-current" />
      </span>
      <div className="member-ai-insight-body">
        <div className="member-ai-insight-top">
          <span className="member-ai-insight-tone">
            {memberInsightToneLabel(insight.tone)}
          </span>
        </div>
        <p className="member-ai-insight-title">{insight.title}</p>
        <p className="member-ai-insight-detail">{insight.detail}</p>
      </div>
    </li>
  );
}

export function MemberAiInsightsCard({
  snapshot = UNAVAILABLE_MEMBER_AI_INSIGHTS,
  embedded = false,
}: MemberAiInsightsCardProps) {
  const hasInsights = snapshot.insights.length > 0;

  return (
    <div
      className={
        embedded
          ? "member-ai-insights member-ai-insights--embedded"
          : "member-ai-insights member-ai-insights--standalone"
      }
      aria-label="AI Insights"
    >
      <div className="member-ai-insights-header">
        <span className="member-ai-insights-mark" aria-hidden="true">
          <AppIcon icon={Sparkles} size="sm" className="text-current" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="member-ai-insights-title-row">
            {embedded ? null : (
              <h3 className="member-ai-insights-title">AI Insights</h3>
            )}
            <span className="member-ai-insights-preview">Unavailable</span>
          </div>
          <p className="member-ai-insights-headline">{snapshot.headline}</p>
          <p className="member-ai-insights-summary">{snapshot.summary}</p>
        </div>
      </div>

      {hasInsights ? (
        <ul className="member-ai-insights-list" aria-label="Insights">
          {snapshot.insights.map((insight) => (
            <InsightRow key={insight.id} insight={insight} />
          ))}
        </ul>
      ) : null}

      {snapshot.suggestions.length > 0 ? (
        <div className="member-ai-insights-section">
          <p className="member-profile-eyebrow">Suggestions</p>
          <ul className="member-ai-suggestions">
            {snapshot.suggestions.map((suggestion) => (
              <li key={suggestion.id} className="member-ai-suggestion">
                <span className="member-ai-suggestion-dot" aria-hidden="true" />
                <span>{suggestion.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="members-demo-note" role="note">
        No backend AI is generating insights for this pilot.
      </p>
    </div>
  );
}
