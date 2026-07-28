import { useEffect, useState } from "react";

import {
  buildIdeaCommunityInsight,
  type IdeaCommunityInsight,
} from "../lib/idea-community-insight";
import { fetchIdeaPolls } from "../lib/event-suggestion-polish-api";
import {
  fetchIdeaCommunityInsight,
  totalIdeaInterest,
  type EventSuggestion,
} from "../lib/event-suggestions-api";
import {
  RESPONSE_TARGET,
  getDecisionReadiness,
  type DecisionReadiness,
  type DecisionReadinessCheck,
} from "../lib/idea-workspace-metrics";

function assistantStatusChecks(
  idea: EventSuggestion,
  readiness: DecisionReadiness,
): DecisionReadinessCheck[] {
  const responses = totalIdeaInterest(idea.interest_counts);
  const pollsDone = (idea.poll_count ?? 0) > 0;
  const feedbackActive =
    idea.status === "published" && idea.community_feedback_closed_at == null;
  const feedbackClosed = idea.community_feedback_closed_at != null;
  const enoughResponses = responses >= RESPONSE_TARGET;

  if (readiness.status === "idle") {
    return readiness.checks.slice(0, 3);
  }

  return [
    {
      id: "polls",
      label: "Polls published",
      done: pollsDone,
    },
    {
      id: "feedback",
      label: feedbackClosed ? "Feedback closed" : "Feedback active",
      done: feedbackActive || feedbackClosed,
    },
    {
      id: "responses",
      label: enoughResponses ? "Enough responses" : "More responses needed",
      done: enoughResponses,
    },
  ];
}

function confidenceLabel(
  value: DecisionReadiness["confidence"],
): string | null {
  if (value == null) return null;
  return value === "low" ? "Low" : value === "high" ? "High" : "Moderate";
}

export function IdeaBoardAssistantSection({
  idea,
}: {
  idea: EventSuggestion;
}) {
  const readiness = getDecisionReadiness(idea);
  const [insight, setInsight] = useState<IdeaCommunityInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const statusChecks = assistantStatusChecks(idea, readiness);
  const confidence = confidenceLabel(readiness.confidence);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const remote = await fetchIdeaCommunityInsight(idea.id);
        if (cancelled) return;
        setInsight({
          responseCount: remote.response_count,
          insights: remote.insights,
          source: remote.source,
          commentCount: remote.comment_count,
        });
      } catch {
        try {
          const polls = await fetchIdeaPolls(idea.id);
          if (cancelled) return;
          setInsight(buildIdeaCommunityInsight(idea, polls));
        } catch {
          if (!cancelled) {
            setInsight(buildIdeaCommunityInsight(idea, []));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    idea,
    idea.id,
    idea.interest_counts.interested,
    idea.interest_counts.maybe,
    idea.interest_counts.not_interested,
    idea.community_feedback_closed_at,
    idea.open_poll_count,
    idea.poll_count,
    idea.poll_vote_count,
    idea.community_comment_count,
  ]);

  const summaryLines =
    insight?.insights ??
    (loading ? [] : ["Waiting for community signal."]);

  return (
    <section
      className={["idea-board-assistant", `is-${readiness.status}`].join(" ")}
      aria-labelledby="idea-board-assistant"
    >
      <h3 id="idea-board-assistant">Decision assistant</h3>

      <div className="idea-board-assistant__block">
        <p className="idea-board-assistant__label">Summary</p>
        {loading && !insight ? (
          <p className="idea-board-assistant__muted">Summarizing feedback…</p>
        ) : (
          <ul className="idea-board-assistant__summary">
            {summaryLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="idea-board-assistant__block">
        <p className="idea-board-assistant__label">Status</p>
        <ul className="idea-decision-checks">
          {statusChecks.map((check) => (
            <li
              key={check.id}
              className={
                check.done
                  ? "idea-decision-checks__item is-done"
                  : "idea-decision-checks__item"
              }
            >
              <span className="idea-decision-checks__mark" aria-hidden="true">
                {check.done ? "✓" : "○"}
              </span>
              <span>{check.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {(confidence ||
        readiness.reasons.length > 0 ||
        readiness.recommendation) && (
        <div className="idea-board-assistant__block idea-board-assistant__rec-block">
          {confidence ? (
            <p className="idea-board-assistant__confidence">
              <span className="idea-board-assistant__label">Confidence</span>
              <span
                className={[
                  "idea-board-assistant__confidence-value",
                  `is-${readiness.confidence}`,
                ].join(" ")}
              >
                {confidence}
              </span>
            </p>
          ) : null}

          {readiness.reasons.length > 0 ? (
            <div className="idea-board-assistant__reasons">
              <p className="idea-board-assistant__label">
                {readiness.reasonsLabel ?? "Reason"}
              </p>
              <ul className="idea-board-assistant__summary">
                {readiness.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {readiness.recommendation ? (
            <div className="idea-board-assistant__rec-wrap">
              <p className="idea-board-assistant__label">
                {readiness.recommendationLabel ?? "Recommendation"}
              </p>
              <p className="idea-board-assistant__rec">
                {readiness.recommendation}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
