import { useEffect, useState, type FormEvent } from "react";

import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { getApiErrorMessage } from "../lib/api-error";
import {
  createIdeaComment,
  deleteIdeaComment,
  fetchIdeaComments,
  type IdeaComment,
} from "../lib/event-suggestion-comments-api";
import {
  fetchIdeaCommunityInsight,
  isIdeaDiscussionOpen,
  reviewEventSuggestion,
  type EventSuggestion,
} from "../lib/event-suggestions-api";

function formatCommentDate(isoDate: string): string {
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(parsed));
}

function commentTone(content: string): "support" | "concern" | "neutral" {
  const lower = content.toLowerCase();
  if (
    ["avoid", "concern", "difficult", "issue", "worry", "can't", "cannot", "hard"].some(
      (hint) => lower.includes(hint),
    )
  ) {
    return "concern";
  }
  if (
    ["love", "great", "fun", "excited", "support", "yes", "works", "good"].some(
      (hint) => lower.includes(hint),
    )
  ) {
    return "support";
  }
  return "neutral";
}

function CommentRow({
  comment,
  depth = 0,
  canReply,
  onReply,
  onDelete,
}: {
  comment: IdeaComment;
  depth?: number;
  canReply: boolean;
  onReply: (parentId: number) => void;
  onDelete: (commentId: number) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const tone = comment.is_deleted ? "neutral" : commentTone(comment.content);

  return (
    <li
      className={[
        "idea-comments__item",
        depth > 0 ? "is-reply" : "",
        `is-${tone}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="idea-comments__item-head">
        <span className="idea-comments__author">
          {comment.author.full_name}
        </span>
        <span className="idea-comments__date">
          {formatCommentDate(comment.created_at)}
        </span>
      </div>
      <p className="idea-comments__text">
        {comment.is_deleted ? "Comment removed" : comment.content}
      </p>
      {!comment.is_deleted ? (
        <div className="idea-comments__item-actions">
          {canReply && depth === 0 ? (
            <button
              type="button"
              className="idea-comments__text-btn"
              onClick={() => onReply(comment.id)}
            >
              Reply
            </button>
          ) : null}
          {comment.can_delete ? (
            <button
              type="button"
              className="idea-comments__text-btn is-danger"
              disabled={deleting}
              onClick={() => {
                setDeleting(true);
                void onDelete(comment.id).finally(() => setDeleting(false));
              }}
            >
              {deleting ? "Removing…" : "Remove"}
            </button>
          ) : null}
        </div>
      ) : null}
      {comment.replies.length > 0 ? (
        <ul className="idea-comments__replies">
          {comment.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              canReply={false}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function IdeaCommunityCommentsSection({
  idea,
  onIdeaUpdated,
}: {
  idea: EventSuggestion;
  onIdeaUpdated?: (updated: EventSuggestion) => void;
}) {
  const discussionOpen = isIdeaDiscussionOpen(idea);
  const canBoard = idea.can_board_review;
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<IdeaComment[]>([]);
  const [total, setTotal] = useState(idea.community_comment_count ?? 0);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [insightLines, setInsightLines] = useState<string[]>([]);
  const [insightLoading, setInsightLoading] = useState(false);

  async function reloadComments() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchIdeaComments(idea.id);
      setComments(data.comments);
      setTotal(data.total);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void reloadComments();
  }, [open, idea.id, idea.community_feedback_closed_at]);

  useEffect(() => {
    if (!canBoard || !open) return;
    let cancelled = false;
    setInsightLoading(true);
    void fetchIdeaCommunityInsight(idea.id)
      .then((insight) => {
        if (!cancelled) setInsightLines(insight.insights);
      })
      .catch(() => {
        if (!cancelled) setInsightLines([]);
      })
      .finally(() => {
        if (!cancelled) setInsightLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    canBoard,
    open,
    idea.id,
    idea.interest_counts.interested,
    idea.interest_counts.maybe,
    idea.interest_counts.not_interested,
    idea.poll_vote_count,
    total,
  ]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || saving || !discussionOpen) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await createIdeaComment(idea.id, {
        content,
        parent_id: replyTo,
      });
      setDraft("");
      setReplyTo(null);
      await reloadComments();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(commentId: number) {
    setErrorMessage(null);
    try {
      await deleteIdeaComment(idea.id, commentId);
      await reloadComments();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    }
  }

  async function enableComments() {
    if (!canBoard || enabling || !onIdeaUpdated) return;
    setEnabling(true);
    setErrorMessage(null);
    try {
      const updated = await reviewEventSuggestion(idea.id, {
        feedback_package: {
          attendance_interest: idea.community_interest_enabled !== false,
          discussion: true,
          preferred_semester: false,
          transportation: false,
          budget: false,
          volunteer_interest: false,
        },
      });
      onIdeaUpdated(updated);
      setOpen(true);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setEnabling(false);
    }
  }

  const showEnable =
    canBoard &&
    idea.status === "published" &&
    idea.community_feedback_closed_at == null &&
    idea.community_discussion_enabled === false;

  const liveCount = open ? total : (idea.community_comment_count ?? total);

  return (
    <Card
      padding="none"
      className="idea-ws-card idea-comments"
      aria-labelledby="idea-community-comments"
    >
      <button
        type="button"
        className="idea-comments__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span id="idea-community-comments" className="idea-comments__title">
          Community comments
          <span className="idea-comments__count">{liveCount}</span>
        </span>
        <span className="idea-comments__chevron" aria-hidden="true">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div className="idea-comments__body">
          {canBoard ? (
            <section
              className="idea-comments__insight"
              aria-labelledby="idea-comments-insight"
            >
              <h3 id="idea-comments-insight">AI summary</h3>
              {insightLoading ? (
                <p className="idea-comments__muted">Summarizing comments…</p>
              ) : insightLines.length > 0 ? (
                <ul>
                  {insightLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="idea-comments__muted">
                  Insight will appear as attendance, polls, and comments come in.
                </p>
              )}
            </section>
          ) : null}

          {showEnable ? (
            <div className="idea-comments__enable">
              <p className="idea-comments__muted">
                Comments are off for this idea. Turn them on to collect qualitative
                feedback.
              </p>
              <Button
                type="button"
                size="sm"
                loading={enabling}
                disabled={enabling}
                onClick={() => void enableComments()}
              >
                Enable community comments
              </Button>
            </div>
          ) : null}

          {loading ? (
            <p className="idea-comments__muted">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="idea-comments__muted">
              {discussionOpen
                ? "No comments yet. Share timing constraints, concerns, or support."
                : "No comments were left during feedback."}
            </p>
          ) : (
            <ul className="idea-comments__list">
              {comments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  canReply={discussionOpen}
                  onReply={setReplyTo}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}

          {discussionOpen ? (
            <form
              className="idea-comments__composer"
              onSubmit={(event) => void handleSubmit(event)}
            >
              {replyTo != null ? (
                <p className="idea-comments__replying">
                  Replying to a comment{" "}
                  <button
                    type="button"
                    className="idea-comments__text-btn"
                    onClick={() => setReplyTo(null)}
                  >
                    Cancel
                  </button>
                </p>
              ) : null}
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Share a short comment for the board…"
                disabled={saving}
                aria-label="Community comment"
              />
              <div className="idea-comments__composer-actions">
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || !draft.trim()}
                  loading={saving}
                >
                  Post comment
                </Button>
              </div>
            </form>
          ) : !showEnable ? (
            <p className="idea-comments__muted">
              Comments are closed for this idea.
            </p>
          ) : null}

          {errorMessage ? (
            <p className="ds-field-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
