import { useEffect, useState, type FormEvent } from "react";

import { Button } from "./ui/Button";
import { getApiErrorMessage } from "../lib/api-error";
import {
  createIdeaComment,
  deleteIdeaComment,
  fetchIdeaComments,
  type IdeaComment,
} from "../lib/event-suggestion-comments-api";
import { isIdeaDiscussionOpen, type EventSuggestionStatus } from "../lib/event-suggestions-api";

function formatCommentDate(isoDate: string): string {
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

function CommentComposer({
  placeholder,
  submitLabel,
  disabled,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || saving || disabled) {
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      await onSubmit(content);
      setDraft("");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="idea-comment-composer" onSubmit={(e) => void handleSubmit(e)}>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={saving || disabled}
        maxLength={2000}
      />
      {errorMessage ? (
        <p className="idea-workspace-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="idea-comment-composer__actions">
        {onCancel ? (
          <button
            type="button"
            className="idea-comment-text-btn"
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
        <Button
          type="submit"
          size="sm"
          disabled={saving || disabled || !draft.trim()}
          loading={saving}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  suggestionId,
  discussionOpen,
  onChanged,
}: {
  comment: IdeaComment;
  suggestionId: number;
  discussionOpen: boolean;
  onChanged: () => Promise<void>;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const when = formatCommentDate(comment.created_at);

  async function handleDelete() {
    if (deleting || !comment.can_delete) {
      return;
    }
    setDeleting(true);
    setErrorMessage(null);
    try {
      await deleteIdeaComment(suggestionId, comment.id);
      await onChanged();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className={["idea-comment", comment.is_deleted ? "is-deleted" : ""].filter(Boolean).join(" ")}>
      <div className="idea-comment__meta">
        <span className="idea-comment__author">{comment.author.full_name}</span>
        {when ? (
          <>
            <span className="idea-workspace-sep" aria-hidden="true">
              ·
            </span>
            <span>{when}</span>
          </>
        ) : null}
      </div>
      <p className="idea-comment__body">{comment.content}</p>
      {!comment.is_deleted && comment.parent_id === null ? (
        <div className="idea-comment__actions">
          {discussionOpen ? (
            <button
              type="button"
              className="idea-comment-text-btn"
              onClick={() => setReplyOpen((open) => !open)}
            >
              {replyOpen ? "Cancel reply" : "Reply"}
            </button>
          ) : null}
          {comment.can_delete ? (
            <button
              type="button"
              className="idea-comment-text-btn is-danger"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          ) : null}
        </div>
      ) : null}
      {!comment.is_deleted && comment.parent_id !== null && comment.can_delete ? (
        <div className="idea-comment__actions">
          <button
            type="button"
            className="idea-comment-text-btn is-danger"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      ) : null}
      {errorMessage ? (
        <p className="idea-workspace-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {replyOpen ? (
        <CommentComposer
          placeholder="Write a reply…"
          submitLabel="Reply"
          onCancel={() => setReplyOpen(false)}
          onSubmit={async (content) => {
            await createIdeaComment(suggestionId, {
              content,
              parent_id: comment.id,
            });
            setReplyOpen(false);
            await onChanged();
          }}
        />
      ) : null}
      {comment.replies.length > 0 ? (
        <ul className="idea-comment-replies">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              suggestionId={suggestionId}
              discussionOpen={discussionOpen}
              onChanged={onChanged}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function IdeaDiscussionSection({
  suggestionId,
  status,
}: {
  suggestionId: number;
  status: EventSuggestionStatus;
}) {
  const [comments, setComments] = useState<IdeaComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const discussionOpen = isIdeaDiscussionOpen(status);

  async function reload() {
    const response = await fetchIdeaComments(suggestionId);
    setComments(response.comments);
    setTotal(response.total);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetchIdeaComments(suggestionId);
        if (!cancelled) {
          setComments(response.comments);
          setTotal(response.total);
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
  }, [suggestionId]);

  return (
    <section className="idea-workspace-section" aria-labelledby="idea-discussion">
      <div className="idea-interest-heading">
        <h2 id="idea-discussion" className="idea-workspace-section__title">
          Discussion
        </h2>
        <p className="idea-interest-summary">
          {total === 0
            ? "No comments yet"
            : `${total} ${total === 1 ? "comment" : "comments"}`}
        </p>
      </div>

      {discussionOpen ? (
        <CommentComposer
          placeholder="Share a thought about this idea…"
          submitLabel="Comment"
          onSubmit={async (content) => {
            await createIdeaComment(suggestionId, { content });
            await reload();
          }}
        />
      ) : (
        <p className="idea-workspace-placeholder">
          Discussion is closed for this idea.
        </p>
      )}

      {errorMessage ? (
        <div className="ds-alert-banner p-3 text-sm" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <p className="idea-workspace-placeholder">Loading discussion…</p>
      ) : comments.length === 0 ? (
        discussionOpen ? (
          <p className="idea-workspace-placeholder">
            Start the conversation — replies stay one level deep.
          </p>
        ) : null
      ) : (
        <ul className="idea-comment-list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              suggestionId={suggestionId}
              discussionOpen={discussionOpen}
              onChanged={reload}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
