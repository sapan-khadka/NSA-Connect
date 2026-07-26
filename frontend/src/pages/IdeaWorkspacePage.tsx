import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchEventSuggestion,
  IDEA_STATUS_LABEL,
  type EventSuggestion,
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

      <section className="idea-workspace-section" aria-labelledby="idea-interest">
        <h2 id="idea-interest" className="idea-workspace-section__title">
          Interest
        </h2>
        <p className="idea-workspace-placeholder">
          Interest voting comes in a later phase — members will be able to mark
          Interested, Maybe, or Not interested.
        </p>
      </section>

      <section
        className="idea-workspace-section"
        aria-labelledby="idea-discussion"
      >
        <h2 id="idea-discussion" className="idea-workspace-section__title">
          Discussion
        </h2>
        <p className="idea-workspace-placeholder">
          Threaded comments will live here so members can shape the idea before
          board review.
        </p>
      </section>

      <section className="idea-workspace-section" aria-labelledby="idea-board">
        <h2 id="idea-board" className="idea-workspace-section__title">
          Board review
        </h2>
        <p className="idea-workspace-placeholder">
          Approve, reject, and convert-to-event actions will land here once the
          review workflow is ready.
        </p>
        {idea.noted_by ? (
          <p className="idea-workspace-note">
            Reviewed by {idea.noted_by.full_name}
            {idea.noted_at ? ` · ${formatDate(idea.noted_at)}` : ""}
          </p>
        ) : null}
      </section>
    </div>
  );
}
