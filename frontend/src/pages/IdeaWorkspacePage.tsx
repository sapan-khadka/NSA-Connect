import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { IdeaBoardReviewSection } from "../components/IdeaBoardReviewSection";
import { IdeaDiscussionSection } from "../components/IdeaDiscussionSection";
import { getApiErrorMessage } from "../lib/api-error";
import {
  clearEventSuggestionInterest,
  fetchEventSuggestion,
  IDEA_INTEREST_LABEL,
  IDEA_INTEREST_OPTIONS,
  IDEA_STATUS_LABEL,
  isIdeaInterestOpen,
  setEventSuggestionInterest,
  totalIdeaInterest,
  type EventSuggestion,
  type IdeaInterestVote,
} from "../lib/event-suggestions-api";

function formatDate(isoDate: string): string {
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed));
}

function InterestSection({
  idea,
  onUpdated,
}: {
  idea: EventSuggestion;
  onUpdated: (updated: EventSuggestion) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const open = isIdeaInterestOpen(idea.status);
  const total = totalIdeaInterest(idea.interest_counts);

  async function handleVote(vote: IdeaInterestVote) {
    if (!open || saving) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const updated =
        idea.my_interest === vote
          ? await clearEventSuggestionInterest(idea.id)
          : await setEventSuggestionInterest(idea.id, vote);
      onUpdated(updated);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="idea-workspace-section" aria-labelledby="idea-interest">
      <div className="idea-interest-heading">
        <h2 id="idea-interest" className="idea-workspace-section__title">
          Interest
        </h2>
        <p className="idea-interest-summary">
          {total === 0
            ? "No votes yet"
            : `${idea.interest_counts.interested} interested · ${idea.interest_counts.maybe} maybe · ${idea.interest_counts.not_interested} not`}
        </p>
      </div>

      {open ? (
        <div
          className="idea-interest-options"
          role="group"
          aria-label="Your interest"
        >
          {IDEA_INTEREST_OPTIONS.map((vote) => {
            const selected = idea.my_interest === vote;
            return (
              <button
                key={vote}
                type="button"
                className={[
                  "idea-interest-option",
                  `is-${vote}`,
                  selected ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={selected}
                disabled={saving}
                onClick={() => void handleVote(vote)}
              >
                <span className="idea-interest-option__label">
                  {IDEA_INTEREST_LABEL[vote]}
                </span>
                <span className="idea-interest-option__count">
                  {idea.interest_counts[vote]}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="idea-workspace-placeholder">
          Interest voting is closed for this idea.
        </p>
      )}

      {open && idea.my_interest ? (
        <p className="idea-interest-yours">
          Your vote: {IDEA_INTEREST_LABEL[idea.my_interest]}. Click again to
          clear.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="idea-workspace-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

export function IdeaWorkspacePage() {
  const { ideaId } = useParams();
  const numericId = Number(ideaId);

  const [idea, setIdea] = useState<EventSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        if (!cancelled) {
          setIdea(response);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getApiErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [numericId]);

  if (loading) {
    return <p className="idea-workspace-loading">Loading idea…</p>;
  }

  if (errorMessage || !idea) {
    return (
      <div className="idea-workspace">
        <Link to="/events/ideas" className="idea-workspace-back">
          ← Back to ideas
        </Link>
        <div className="ds-alert-banner p-4 text-sm" role="alert">
          {errorMessage ?? "Idea not found."}
        </div>
      </div>
    );
  }

  const timing = idea.preferred_timing?.trim() || "Any semester";
  const created = formatDate(idea.created_at);
  const interestedCount = idea.interest_counts.interested;

  return (
    <div className="idea-workspace">
      <Link to="/events/ideas" className="idea-workspace-back">
        ← Back to ideas
      </Link>

      <header className="idea-workspace-header">
        <div className="idea-workspace-header__top">
          <h1 className="idea-workspace-title">{idea.title}</h1>
          <span
            className={[
              "idea-workspace-status",
              `is-${idea.status}`,
            ].join(" ")}
          >
            {IDEA_STATUS_LABEL[idea.status]}
          </span>
        </div>
        <p className="idea-workspace-meta">
          <span>{idea.suggested_by.full_name}</span>
          <span className="idea-workspace-sep" aria-hidden="true">
            ·
          </span>
          <span>{timing}</span>
          {created ? (
            <>
              <span className="idea-workspace-sep" aria-hidden="true">
                ·
              </span>
              <span>{created}</span>
            </>
          ) : null}
          {interestedCount > 0 ? (
            <>
              <span className="idea-workspace-sep" aria-hidden="true">
                ·
              </span>
              <span>
                {interestedCount} interested
              </span>
            </>
          ) : null}
        </p>
      </header>

      <section className="idea-workspace-section" aria-labelledby="idea-overview">
        <h2 id="idea-overview" className="idea-workspace-section__title">
          Overview
        </h2>
        <p className="idea-workspace-body">
          {idea.description.trim() || "No description provided."}
        </p>
      </section>

      <InterestSection idea={idea} onUpdated={setIdea} />

      <IdeaDiscussionSection suggestionId={idea.id} status={idea.status} />

      <IdeaBoardReviewSection idea={idea} onUpdated={setIdea} />
    </div>
  );
}
