import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "./ui/Button";
import { getApiErrorMessage } from "../lib/api-error";
import {
  closeIdeaPoll,
  createIdeaPoll,
  fetchIdeaActivity,
  fetchIdeaPoll,
  fetchRelatedIdeas,
  voteIdeaPoll,
  type IdeaActivityItem,
  type IdeaPoll,
  type IdeaRelatedItem,
} from "../lib/event-suggestion-polish-api";
import { IDEA_STATUS_LABEL } from "../lib/event-suggestions-api";

function formatWhen(isoDate: string): string {
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function ActivitySection({ suggestionId }: { suggestionId: number }) {
  const [items, setItems] = useState<IdeaActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchIdeaActivity(suggestionId)
      .then((rows) => {
        if (!cancelled) {
          setItems(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [suggestionId]);

  return (
    <section className="idea-workspace-section" aria-labelledby="idea-activity">
      <h2 id="idea-activity" className="idea-workspace-section__title">
        Activity
      </h2>
      {loading ? (
        <p className="idea-workspace-placeholder">Loading activity…</p>
      ) : items.length === 0 ? (
        <p className="idea-workspace-placeholder">No activity yet.</p>
      ) : (
        <ol className="idea-activity-list">
          {items.map((item, index) => (
            <li key={`${item.kind}-${item.created_at}-${index}`} className="idea-activity-item">
              <p className="idea-activity-item__summary">{item.summary}</p>
              <p className="idea-activity-item__when">{formatWhen(item.created_at)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RelatedSection({ suggestionId }: { suggestionId: number }) {
  const [ideas, setIdeas] = useState<IdeaRelatedItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchRelatedIdeas(suggestionId)
      .then((rows) => {
        if (!cancelled) {
          setIdeas(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIdeas([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [suggestionId]);

  if (ideas.length === 0) {
    return null;
  }

  return (
    <section className="idea-workspace-section" aria-labelledby="idea-related">
      <h2 id="idea-related" className="idea-workspace-section__title">
        Related ideas
      </h2>
      <ul className="idea-related-list">
        {ideas.map((idea) => (
          <li key={idea.id}>
            <Link to={`/events/ideas/${idea.id}`} className="idea-related-link">
              <span className="idea-related-link__title">{idea.title}</span>
              <span className="idea-related-link__meta">
                {IDEA_STATUS_LABEL[idea.status]}
                {idea.interested_count > 0
                  ? ` · ${idea.interested_count} interested`
                  : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PollSection({
  suggestionId,
  canManage,
}: {
  suggestionId: number;
  canManage: boolean;
}) {
  const [poll, setPoll] = useState<IdeaPoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [optionsText, setOptionsText] = useState("Weekend\nWeekday evening");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchIdeaPoll(suggestionId)
      .then((next) => {
        if (!cancelled) {
          setPoll(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPoll(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [suggestionId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const options = optionsText
      .split("\n")
      .map((row) => row.trim())
      .filter(Boolean);
    if (!question.trim() || options.length < 2) {
      setErrorMessage("Add a question and at least two options.");
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      const created = await createIdeaPoll(suggestionId, {
        question: question.trim(),
        options,
      });
      setPoll(created);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleVote(optionId: number) {
    if (!poll?.is_open || saving) {
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      const updated = await voteIdeaPoll(suggestionId, optionId);
      setPoll(updated);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    if (!poll || saving) {
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      const updated = await closeIdeaPoll(suggestionId);
      setPoll(updated);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="idea-workspace-section" aria-labelledby="idea-poll">
      <div className="idea-interest-heading">
        <h2 id="idea-poll" className="idea-workspace-section__title">
          Poll
        </h2>
        {poll ? (
          <p className="idea-interest-summary">
            {poll.total_votes} {poll.total_votes === 1 ? "vote" : "votes"}
            {poll.is_open ? "" : " · closed"}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="idea-workspace-placeholder">Loading poll…</p>
      ) : poll ? (
        <>
          <p className="idea-poll-question">{poll.question}</p>
          <div className="idea-poll-options" role="group" aria-label="Poll options">
            {poll.options.map((option) => {
              const selected = poll.my_option_id === option.id;
              const pct =
                poll.total_votes > 0
                  ? Math.round((option.vote_count / poll.total_votes) * 100)
                  : 0;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={[
                    "idea-poll-option",
                    selected ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={!poll.is_open || saving}
                  onClick={() => void handleVote(option.id)}
                >
                  <span className="idea-poll-option__label">{option.label}</span>
                  <span className="idea-poll-option__count">
                    {option.vote_count} · {pct}%
                  </span>
                </button>
              );
            })}
          </div>
          {canManage && poll.is_open ? (
            <button
              type="button"
              className="idea-comment-text-btn"
              disabled={saving}
              onClick={() => void handleClose()}
            >
              Close poll
            </button>
          ) : null}
        </>
      ) : canManage ? (
        <form className="idea-poll-create" onSubmit={(e) => void handleCreate(e)}>
          <p className="idea-workspace-placeholder">
            Ask members a quick timing or format question.
          </p>
          <label>
            <span>Question</span>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="When should we host this?"
              disabled={saving}
            />
          </label>
          <label>
            <span>Options (one per line)</span>
            <textarea
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              rows={3}
              disabled={saving}
            />
          </label>
          <div className="idea-convert__actions">
            <Button type="submit" size="sm" loading={saving} disabled={saving}>
              Create poll
            </Button>
          </div>
        </form>
      ) : (
        <p className="idea-workspace-placeholder">No poll on this idea yet.</p>
      )}

      {errorMessage ? (
        <p className="idea-workspace-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

export function IdeaPolishSections({
  suggestionId,
  canManage,
}: {
  suggestionId: number;
  canManage: boolean;
}) {
  return (
    <>
      <PollSection suggestionId={suggestionId} canManage={canManage} />
      <ActivitySection suggestionId={suggestionId} />
      <RelatedSection suggestionId={suggestionId} />
    </>
  );
}
