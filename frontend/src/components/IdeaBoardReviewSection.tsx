import { useEffect, useState } from "react";

import { Button } from "./ui/Button";
import { getApiErrorMessage } from "../lib/api-error";
import {
  IDEA_STATUS_LABEL,
  reviewEventSuggestion,
  type BoardUpdatableIdeaStatus,
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

const REVIEW_ACTIONS: {
  status: BoardUpdatableIdeaStatus;
  label: string;
  tone: "default" | "primary" | "danger" | "muted";
}[] = [
  { status: "under_discussion", label: "Open discussion", tone: "default" },
  { status: "approved", label: "Approve", tone: "primary" },
  { status: "rejected", label: "Reject", tone: "danger" },
  { status: "archived", label: "Archive", tone: "muted" },
];

export function IdeaBoardReviewSection({
  idea,
  onUpdated,
}: {
  idea: EventSuggestion;
  onUpdated: (updated: EventSuggestion) => void;
}) {
  const [note, setNote] = useState(idea.board_note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [actingStatus, setActingStatus] = useState<BoardUpdatableIdeaStatus | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setNote(idea.board_note ?? "");
  }, [idea.id, idea.board_note]);

  const busy = savingNote || actingStatus !== null;
  const noteDirty = note.trim() !== (idea.board_note ?? "").trim();
  const isConverted = idea.status === "converted";

  async function saveNote() {
    if (busy || !idea.can_board_review) {
      return;
    }
    setSavingNote(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await reviewEventSuggestion(idea.id, {
        board_note: note.trim() || null,
      });
      onUpdated(updated);
      setSuccessMessage("Board note saved.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSavingNote(false);
    }
  }

  async function applyStatus(status: BoardUpdatableIdeaStatus) {
    if (busy || !idea.can_board_review) {
      return;
    }
    if (isConverted && status !== "archived") {
      return;
    }
    setActingStatus(status);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload: Parameters<typeof reviewEventSuggestion>[1] = { status };
      if (noteDirty) {
        payload.board_note = note.trim() || null;
      }
      const updated = await reviewEventSuggestion(idea.id, payload);
      onUpdated(updated);
      setSuccessMessage(`Marked as ${IDEA_STATUS_LABEL[status].toLowerCase()}.`);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setActingStatus(null);
    }
  }

  if (!idea.can_board_review) {
    return (
      <section className="idea-workspace-section" aria-labelledby="idea-board">
        <h2 id="idea-board" className="idea-workspace-section__title">
          Board review
        </h2>
        <p className="idea-board-outcome">
          Status: {IDEA_STATUS_LABEL[idea.status]}
        </p>
        {idea.noted_by ? (
          <p className="idea-workspace-note">
            Last board action by {idea.noted_by.full_name}
            {idea.noted_at ? ` · ${formatDate(idea.noted_at)}` : ""}
          </p>
        ) : (
          <p className="idea-workspace-placeholder">
            The board has not taken a review action yet.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="idea-workspace-section" aria-labelledby="idea-board">
      <div className="idea-interest-heading">
        <h2 id="idea-board" className="idea-workspace-section__title">
          Board review
        </h2>
        <p className="idea-interest-summary">
          {IDEA_STATUS_LABEL[idea.status]}
        </p>
      </div>

      <p className="idea-board-copy">
        Internal notes stay with the board. Members only see the public status.
      </p>

      <label className="idea-board-note">
        <span className="idea-board-note__label">Internal note</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Context for officers — timing concerns, budget, next steps…"
          disabled={busy}
        />
      </label>

      <div className="idea-board-note__actions">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy || !noteDirty}
          loading={savingNote}
          onClick={() => void saveNote()}
        >
          Save note
        </Button>
      </div>

      <div className="idea-board-actions" role="group" aria-label="Board actions">
        {REVIEW_ACTIONS.map((action) => {
          const selected = idea.status === action.status;
          const disabled =
            busy ||
            selected ||
            (isConverted && action.status !== "archived");
          return (
            <button
              key={action.status}
              type="button"
              className={[
                "idea-board-action",
                `is-${action.tone}`,
                selected ? "is-current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={disabled}
              onClick={() => void applyStatus(action.status)}
            >
              {actingStatus === action.status
                ? "Saving…"
                : selected
                  ? `Current: ${action.label}`
                  : action.label}
            </button>
          );
        })}
      </div>

      <p className="idea-workspace-placeholder">
        Convert to Event comes in the next phase.
      </p>

      {idea.noted_by ? (
        <p className="idea-workspace-note">
          Last board action by {idea.noted_by.full_name}
          {idea.noted_at ? ` · ${formatDate(idea.noted_at)}` : ""}
        </p>
      ) : null}

      {successMessage ? (
        <p className="idea-board-banner is-success" role="status">
          {successMessage}
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
