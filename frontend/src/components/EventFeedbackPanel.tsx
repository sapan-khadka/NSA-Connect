import { useState, type FormEvent } from "react";

import { getApiErrorMessage } from "../lib/api-error";
import type { EventFeedback } from "../lib/events-api";
import { submitEventFeedback } from "../lib/events-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { inputFieldClassName } from "./ui/Input";
import { StarRatingDisplay, StarRatingInput } from "./StarRatingInput";

type EventFeedbackPanelProps = {
  eventId: number;
  canSubmitFeedback: boolean;
  feedback: EventFeedback | null;
  onFeedbackChange: (feedback: EventFeedback | null) => void;
};

export function EventFeedbackPanel({
  eventId,
  canSubmitFeedback,
  feedback,
  onFeedbackChange,
}: EventFeedbackPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function startEditing(existing?: EventFeedback | null) {
    setRating(existing?.rating ?? 0);
    setComment(existing?.comment ?? "");
    setIsEditing(true);
    setErrorMessage(null);
  }

  function cancelEditing() {
    setIsEditing(false);
    setRating(0);
    setComment("");
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (rating < 1) {
      setErrorMessage("Please select a star rating.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const saved = await submitEventFeedback(eventId, {
        rating,
        comment: comment.trim() || null,
      });
      onFeedbackChange(saved);
      setIsEditing(false);
      setComment("");
    } catch (caught) {
      setErrorMessage(getApiErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (!canSubmitFeedback) {
    return null;
  }

  return (
    <section className="event-command-section" aria-label="Feedback">
      <div className="event-command-section-head">
        <h2 className="event-command-kicker">Feedback</h2>
      </div>

      {!feedback && !isEditing ? (
        <>
          <p className="event-command-stat">
            How was this event? Share a rating and optional comment.
          </p>
          <button
            type="button"
            onClick={() => startEditing()}
            className="event-command-btn event-command-btn--primary mt-3"
          >
            Leave feedback
          </button>
        </>
      ) : null}

      {feedback && !isEditing ? (
        <div className="event-page-note">
          <StarRatingDisplay rating={feedback.rating} />
          {feedback.comment ? (
            <p className="event-page-description">{feedback.comment}</p>
          ) : null}
          <p className="event-command-stat">
            Submitted {formatEventDateTime(feedback.created_at)}
          </p>
          <button
            type="button"
            onClick={() => startEditing(feedback)}
            className="event-command-btn mt-3"
          >
            Edit feedback
          </button>
        </div>
      ) : null}

      {isEditing ? (
        <form className="mt-3 space-y-3" onSubmit={(event) => void handleSubmit(event)}>
          <StarRatingInput
            value={rating}
            onChange={setRating}
            disabled={submitting}
          />

          <label className="block text-sm text-label">
            Comment <span className="text-label">(optional)</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="What went well? What could be improved?"
              className={`${inputFieldClassName} mt-1`}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={submitting || rating < 1}
              className="event-command-btn event-command-btn--primary"
            >
              {submitting
                ? "Saving…"
                : feedback
                  ? "Save changes"
                  : "Submit feedback"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={cancelEditing}
              className="event-command-btn"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="mt-3 ds-field-error">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
