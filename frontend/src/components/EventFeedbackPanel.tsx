import { useState, type FormEvent } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import type { EventFeedback } from "../lib/events-api";
import { submitEventFeedback } from "../lib/events-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
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
    <Card as="div" padding="none" className="p-3">
      <p className="text-sm font-medium text-foreground">Post-event feedback</p>

      {!feedback && !isEditing ? (
        <>
          <p className="mt-2 text-sm text-label">
            How was this event? Share a quick rating and optional comment for
            the board.
          </p>
          <Button
            type="button"
            onClick={() => startEditing()}
            size="lg"
            className="mt-3 w-full sm:w-auto"
          >
            Leave feedback
          </Button>
        </>
      ) : null}

      {feedback && !isEditing ? (
        <div className="mt-3 rounded-lg border border-accent/20 bg-accent/5 px-3 py-3">
          <p className="text-sm font-medium text-foreground">Your feedback</p>
          <div className="mt-2">
            <StarRatingDisplay rating={feedback.rating} />
          </div>
          {feedback.comment ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              {feedback.comment}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-label">
            Submitted {formatEventDateTime(feedback.created_at)}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => startEditing(feedback)}
            size="lg"
            className="mt-3 w-full sm:w-auto"
          >
            Edit feedback
          </Button>
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

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="submit"
              disabled={submitting || rating < 1}
              loading={submitting}
              size="lg"
              className="w-full sm:w-auto"
            >
              {feedback ? "Save changes" : "Submit feedback"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={cancelEditing}
              size="lg"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="mt-3 ds-field-error">
          {errorMessage}
        </p>
      ) : null}
    </Card>
  );
}
