import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { IdeaBoardReviewSection } from "../components/IdeaBoardReviewSection";
import { IdeaCommunityCommentsSection } from "../components/IdeaCommunityCommentsSection";
import {
  IdeaActivitySection,
  IdeaPollSection,
} from "../components/IdeaPolishSections";
import { WorkflowProgress } from "../components/WorkflowProgress";
import { Card } from "../components/ui/Card";
import { getApiErrorMessage } from "../lib/api-error";
import {
  clearEventSuggestionInterest,
  fetchEventSuggestion,
  IDEA_INTEREST_LABEL,
  IDEA_INTEREST_OPTIONS,
  isIdeaCommunityFeedbackOpen,
  isIdeaCommunityVisible,
  isIdeaInterestOpen,
  setEventSuggestionInterest,
  totalIdeaInterest,
  type EventSuggestion,
  type IdeaInterestVote,
} from "../lib/event-suggestions-api";
import {
  ATTENDANCE_SIGNAL,
  attendanceDefinitelyPercent,
  attendanceInterestLabel,
  buildWorkflowStepDetails,
  feedbackDeadlineLabel,
  ideaWorkflowStageLabel,
} from "../lib/idea-workspace-metrics";

function formatDate(isoDate: string): string {
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(parsed));
}

const IDEA_WORKFLOW_STEPS = [
  { id: "submitted", label: "Submitted" },
  { id: "internal_review", label: "Review" },
  { id: "community_feedback", label: "Feedback" },
  { id: "decision", label: "Decision" },
  { id: "approved", label: "Approved" },
  { id: "event", label: "Scheduled" },
] as const;

function workflowIndex(idea: EventSuggestion): number {
  switch (idea.status) {
    case "submitted":
      return 0;
    case "internal_review":
      return 1;
    case "published":
      return idea.community_feedback_closed_at != null ? 3 : 2;
    case "approved":
      return 4;
    case "converted":
      return 5;
    case "rejected":
    case "archived":
      return 3;
    default:
      return 0;
  }
}

function IdeaWorkflow({ idea }: { idea: EventSuggestion }) {
  const halted = idea.status === "rejected" || idea.status === "archived";
  const currentLabel =
    idea.status === "rejected"
      ? "Rejected"
      : idea.status === "archived"
        ? "Archived"
        : undefined;
  const responses = totalIdeaInterest(idea.interest_counts);
  const showFeedbackBadge =
    responses > 0 &&
    (idea.status === "published" ||
      idea.status === "approved" ||
      idea.status === "converted" ||
      idea.status === "rejected" ||
      idea.status === "archived");
  const details = buildWorkflowStepDetails(idea);

  const steps = IDEA_WORKFLOW_STEPS.map((step) => ({
    ...step,
    badge:
      step.id === "community_feedback" && showFeedbackBadge
        ? responses
        : undefined,
    detailLines: details[step.id] ?? [],
  }));

  return (
    <WorkflowProgress
      steps={steps}
      currentIndex={workflowIndex(idea)}
      currentLabel={currentLabel}
      halted={halted}
      aria-label="Idea progress"
    />
  );
}

function stageMessage(idea: EventSuggestion): string | null {
  switch (idea.status) {
    case "submitted":
      return idea.can_board_review
        ? "Private to officers. Start internal review or reject."
        : "Awaiting board triage. Community feedback is not open yet.";
    case "internal_review":
      return idea.can_board_review
        ? "Add internal notes, then open community review when ready."
        : "The board is reviewing this idea privately.";
    case "published":
      return idea.community_feedback_closed_at
        ? "Community feedback closed. Ready for a board decision."
        : "Collecting attendance interest and poll responses.";
    case "approved":
      return "Approved. Convert to an event when ready.";
    case "rejected":
      return "This idea was rejected.";
    case "archived":
      return "This idea is archived.";
    case "converted":
      return "Scheduled as an event.";
    default:
      return null;
  }
}

type SummaryTone = "muted" | "pending" | "positive" | "caution" | "negative";

function percentTone(value: number | null): SummaryTone {
  if (value == null) return "muted";
  if (value >= 66) return "positive";
  if (value >= 33) return "pending";
  return "caution";
}

function deadlineTone(idea: EventSuggestion): SummaryTone {
  const label = feedbackDeadlineLabel(idea);
  if (label === "Closed") return "positive";
  if (label === "Not open") return "muted";
  if (label === "Past window" || label === "Ends today") return "caution";
  return "pending";
}

function SummaryValue({
  tone,
  children,
}: {
  tone: SummaryTone;
  children: string;
}) {
  return (
    <dd className="idea-summary-grid__value">
      <span
        className={["idea-summary-dot", `is-${tone}`].join(" ")}
        aria-hidden="true"
      />
      <span>{children}</span>
    </dd>
  );
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function IdeaSummaryCard({ idea }: { idea: EventSuggestion }) {
  const responses = totalIdeaInterest(idea.interest_counts);
  const definitely = attendanceDefinitelyPercent(idea);
  const openPolls = idea.open_poll_count ?? 0;
  const totalPolls = idea.poll_count ?? 0;

  return (
    <Card padding="none" className="idea-ws-card" aria-labelledby="idea-summary">
      <h2
        id="idea-summary"
        className="text-sm font-semibold uppercase tracking-wide text-label"
      >
        Summary
      </h2>
      <dl className="idea-summary-grid">
        <div className="idea-summary-grid__item">
          <dt className="idea-summary-grid__label">Community responses</dt>
          <SummaryValue tone={responses > 0 ? "pending" : "muted"}>
            {countLabel(responses, "response", "responses")}
          </SummaryValue>
        </div>
        <div className="idea-summary-grid__item">
          <dt className="idea-summary-grid__label">Attendance interest</dt>
          <SummaryValue tone={percentTone(definitely)}>
            {attendanceInterestLabel(idea)}
          </SummaryValue>
        </div>
        <div className="idea-summary-grid__item">
          <dt className="idea-summary-grid__label">Active polls</dt>
          <SummaryValue
            tone={
              totalPolls === 0
                ? "muted"
                : openPolls > 0
                  ? "pending"
                  : "positive"
            }
          >
            {totalPolls === 0 ? "None" : String(openPolls)}
          </SummaryValue>
        </div>
        <div className="idea-summary-grid__item">
          <dt className="idea-summary-grid__label">Deadline</dt>
          <SummaryValue tone={deadlineTone(idea)}>
            {feedbackDeadlineLabel(idea)}
          </SummaryValue>
        </div>
      </dl>
    </Card>
  );
}

function InterestPanel({
  idea,
  onUpdated,
}: {
  idea: EventSuggestion;
  onUpdated: (updated: EventSuggestion) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const open = isIdeaInterestOpen(
    idea.status,
    idea.community_interest_enabled !== false,
    idea.community_feedback_closed_at != null,
  );
  const total = totalIdeaInterest(idea.interest_counts);
  const dense = total >= ATTENDANCE_SIGNAL;
  const [detailsOpen, setDetailsOpen] = useState(dense);

  useEffect(() => {
    setDetailsOpen(dense);
  }, [idea.id, dense]);

  async function handleVote(vote: IdeaInterestVote) {
    if (!open || saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      onUpdated(
        idea.my_interest === vote
          ? await clearEventSuggestionInterest(idea.id)
          : await setEventSuggestionInterest(idea.id, vote),
      );
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      padding="none"
      className="idea-ws-card idea-ws-card--compact idea-attendance"
      aria-labelledby="idea-interest"
    >
      <div className="idea-attendance__header">
        <h2
          id="idea-interest"
          className="text-sm font-semibold uppercase tracking-wide text-label"
        >
          Community interest
        </h2>
        <p className="idea-attendance__count">
          {total} {total === 1 ? "response" : "responses"}
          {!open ? " · Locked" : ""}
        </p>
      </div>

      <div className="idea-attendance__metric">
        {total > 0 ? (
          <>
            <span className="idea-attendance__metric-value">
              {attendanceDefinitelyPercent(idea)}%
            </span>
            <span className="idea-attendance__metric-label">Definitely</span>
          </>
        ) : (
          <span className="idea-attendance__metric-empty">No responses yet</span>
        )}
      </div>

      {detailsOpen ? (
        <>
          <p className="mt-2 text-sm text-label">Would you attend?</p>
          <ul
            className="idea-result-bars idea-result-bars--compact mt-2"
            aria-label="Community interest"
          >
            {IDEA_INTEREST_OPTIONS.map((vote) => {
              const count = idea.interest_counts[vote];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <li key={vote}>
                  <div className="idea-result-bars__row">
                    <span className="idea-result-bars__label">
                      {IDEA_INTEREST_LABEL[vote]}
                    </span>
                    <span className="idea-result-bars__track" aria-hidden="true">
                      <span
                        className={["idea-result-bars__fill", `is-${vote}`].join(
                          " ",
                        )}
                        style={{ width: `${Math.max(pct, count > 0 ? 6 : 0)}%` }}
                      />
                    </span>
                    <span className="idea-result-bars__count">{count}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <button
        type="button"
        className="mt-2 text-xs font-medium text-accent hover:underline"
        onClick={() => setDetailsOpen((value) => !value)}
      >
        {detailsOpen ? "▲ Hide details" : "▼ Show details"}
      </button>

      {open ? (
        <div className="mt-2.5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-label">
            Your response
          </p>
          <div
            className="mt-1.5 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Your attendance response"
          >
            {IDEA_INTEREST_OPTIONS.map((vote) => {
              const selected = idea.my_interest === vote;
              return (
                <button
                  key={vote}
                  type="button"
                  className={[
                    "rounded-md border px-2.5 py-1 text-xs transition",
                    selected
                      ? "border-primary bg-primary/5 font-medium text-primary"
                      : "border-gray-200 bg-surface-card text-foreground hover:border-gray-300",
                    saving ? "opacity-60" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={selected}
                  disabled={saving}
                  onClick={() => void handleVote(vote)}
                >
                  {IDEA_INTEREST_LABEL[vote]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </Card>
  );
}

export function IdeaWorkspacePage() {
  const { ideaId } = useParams();
  const numericId = Number(ideaId);

  const [idea, setIdea] = useState<EventSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollVersion, setPollVersion] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(numericId)) {
      setErrorMessage("Invalid idea.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetchEventSuggestion(numericId);
        if (!cancelled) setIdea(response);
      } catch (error) {
        if (!cancelled) setErrorMessage(getApiErrorMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [numericId]);

  if (loading) {
    return <p className="text-sm text-label">Loading idea…</p>;
  }

  if (errorMessage || !idea) {
    return (
      <div className="space-y-4">
        <Link to="/events/ideas" className="ds-link">
          ← Back to ideas
        </Link>
        <div className="ds-alert-banner p-6" role="alert">
          {errorMessage ?? "Idea not found."}
        </div>
      </div>
    );
  }

  const timing = idea.preferred_timing?.trim();
  const created = formatDate(idea.created_at);
  const description = idea.description.trim();
  const showCommunity = isIdeaCommunityVisible(idea);
  const showInterest =
    showCommunity && idea.community_interest_enabled !== false;
  const feedbackOpen = isIdeaCommunityFeedbackOpen(idea);
  const showActivity = idea.status !== "submitted";
  const isConverted = idea.status === "converted";
  const showBoard = idea.can_board_review;
  const showSummary = showBoard || showCommunity;
  const showAside = showSummary || showBoard;
  const message = stageMessage(idea);
  const feedbackClosedAt = idea.community_feedback_closed_at;
  const showPolls =
    showCommunity &&
    ((idea.poll_count ?? 0) > 0 || (showBoard && feedbackOpen));

  function handleBoardUpdated(updated: EventSuggestion) {
    setIdea(updated);
    if (
      updated.status === "published" ||
      updated.community_feedback_closed_at !== feedbackClosedAt
    ) {
      setPollVersion((value) => value + 1);
    }
  }

  return (
    <div className="idea-ws space-y-4">
      <div>
        <Link to="/events/ideas" className="ds-link">
          ← Back to ideas
        </Link>
      </div>

      <Card padding="none" className="idea-ws-card idea-ws-hero">
        <div className="idea-ws-hero__body">
          <h1 className="idea-ws-hero__title">{idea.title}</h1>

          <p className="idea-ws-hero__by">
            Suggested by{" "}
            <span className="font-medium text-foreground">
              {idea.suggested_by.full_name}
            </span>
            {idea.suggested_by.position?.trim() ? (
              <span className="text-label">
                {" "}
                · {idea.suggested_by.position.trim()}
              </span>
            ) : null}
          </p>

          <p className="idea-ws-hero__meta">
            {[
              created ? `Submitted ${created}` : null,
              timing || null,
              ideaWorkflowStageLabel(idea),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {description ? (
            <details className="idea-ws-hero__details">
              <summary>Description</summary>
              <p className="idea-ws-hero__description">{description}</p>
            </details>
          ) : null}

          <IdeaWorkflow idea={idea} />

          {message ? <p className="idea-ws-hero__status">{message}</p> : null}

          {idea.converted_event_id ? (
            <p className="text-sm">
              <Link
                to={`/events/${idea.converted_event_id}/manage`}
                className="font-medium text-accent hover:underline"
              >
                View event →
              </Link>
            </p>
          ) : null}
        </div>
      </Card>

      <div className="idea-ws-layout">
        <div className="idea-ws-main space-y-3">
          {showCommunity ? (
            <>
              {showInterest ? (
                <InterestPanel idea={idea} onUpdated={setIdea} />
              ) : null}
              {showPolls ? (
                <IdeaPollSection
                  key={pollVersion}
                  suggestionId={idea.id}
                  idea={idea}
                  canManage={showBoard && feedbackOpen}
                />
              ) : null}
              {showCommunity &&
              (idea.community_discussion_enabled !== false ||
                (idea.community_comment_count ?? 0) > 0 ||
                showBoard) ? (
                <IdeaCommunityCommentsSection
                  idea={idea}
                  onIdeaUpdated={setIdea}
                />
              ) : null}
            </>
          ) : showBoard ? (
            <Card padding="none" className="idea-ws-card">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-label">
                Community feedback
              </h2>
              <p className="mt-2 text-sm text-label">
                Opens after you publish this idea for community review.
              </p>
            </Card>
          ) : null}

          {showActivity ? (
            <IdeaActivitySection suggestionId={idea.id} idea={idea} />
          ) : null}
        </div>

        {showAside ? (
          <aside className="idea-ws-aside space-y-3">
            {showSummary ? <IdeaSummaryCard idea={idea} /> : null}

            {showBoard && !isConverted ? (
              <IdeaBoardReviewSection
                idea={idea}
                onUpdated={handleBoardUpdated}
              />
            ) : null}

            {isConverted && showBoard ? (
              <Card padding="none" className="idea-ws-card">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-label">
                  Board review
                </h2>
                <p className="mt-2 text-sm text-label">
                  This idea was converted. The workspace is read-only.
                </p>
                {idea.converted_event_id ? (
                  <p className="mt-2 text-sm">
                    <Link
                      to={`/events/${idea.converted_event_id}/manage`}
                      className="font-medium text-accent hover:underline"
                    >
                      View event →
                    </Link>
                  </p>
                ) : null}
              </Card>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
