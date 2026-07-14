/**
 * AI Insights card — premium placeholder UX. No backend AI calls.
 */

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { AppIcon } from "./ui/AppIcon";
import {
  memberInsightToneLabel,
  PLACEHOLDER_MEMBER_AI_INSIGHTS,
  type MemberAiInsightsSnapshot,
  type MemberInsight,
  type MemberInsightAction,
} from "../lib/member-ai-insights";

type MemberAiInsightsCardProps = {
  /** Override snapshot for tests or future real data. Defaults to placeholders. */
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
  snapshot = PLACEHOLDER_MEMBER_AI_INSIGHTS,
  embedded = false,
}: MemberAiInsightsCardProps) {
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  function handleAction(action: MemberInsightAction) {
    // UX-only: acknowledge the click without calling any API / AI backend.
    setSelectedActionId(action.id);
  }

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
            <span className="member-ai-insights-preview">Preview</span>
          </div>
          <p className="member-ai-insights-headline">{snapshot.headline}</p>
          <p className="member-ai-insights-summary">{snapshot.summary}</p>
        </div>
      </div>

      <ul className="member-ai-insights-list" aria-label="Insights">
        {snapshot.insights.map((insight) => (
          <InsightRow key={insight.id} insight={insight} />
        ))}
      </ul>

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

      <div className="member-ai-insights-section">
        <p className="member-profile-eyebrow">Suggested actions</p>
        <div
          className="member-ai-actions"
          role="group"
          aria-label="Suggested actions"
        >
          {snapshot.actions.map((action) => {
            const isSelected = selectedActionId === action.id;
            return (
              <button
                key={action.id}
                type="button"
                className={`member-ai-action member-ai-action--${action.intent}${
                  isSelected ? " member-ai-action--selected" : ""
                }`}
                onClick={() => handleAction(action)}
              >
                {action.label}
              </button>
            );
          })}
        </div>
        {selectedActionId ? (
          <p className="member-ai-action-note" role="status">
            Action noted for review — AI suggestions are preview-only for now.
          </p>
        ) : null}
      </div>

      <p className="members-demo-note" role="note">
        Placeholder UX only. No backend AI is generating these insights.
      </p>
    </div>
  );
}
