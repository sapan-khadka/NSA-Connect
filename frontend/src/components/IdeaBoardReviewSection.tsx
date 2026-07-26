import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "./ui/Button";
import { getApiErrorMessage } from "../lib/api-error";
import {
  combineDateAndTime,
  getMinEventDate,
} from "../lib/event-form";
import { EVENT_TYPE_LABELS, EVENT_TYPES, type EventType } from "../lib/event-types";
import {
  convertEventSuggestion,
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

function ConvertedLink({ eventId }: { eventId: number }) {
  return (
    <p className="idea-board-converted">
      Converted to an event.{" "}
      <Link to={`/events/${eventId}/manage`} className="idea-board-converted__link">
        Open event manage →
      </Link>
    </p>
  );
}

function ConvertForm({
  idea,
  onUpdated,
}: {
  idea: EventSuggestion;
  onUpdated: (updated: EventSuggestion) => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState(idea.title);
  const [description, setDescription] = useState(idea.description);
  const [eventType, setEventType] = useState<EventType>("cultural");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("0.00");
  const [converting, setConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConvert(event: FormEvent) {
    event.preventDefault();
    if (converting) {
      return;
    }
    if (!eventDate || !eventTime) {
      setErrorMessage("Choose a date and time for the event.");
      return;
    }

    setConverting(true);
    setErrorMessage(null);
    try {
      const updated = await convertEventSuggestion(idea.id, {
        name: name.trim() || idea.title,
        description: description.trim() || idea.description,
        event_type: eventType,
        starts_at: combineDateAndTime(eventDate, eventTime),
        location: location.trim() || null,
        budget: budget.trim() || "0.00",
      });
      onUpdated(updated);
      if (updated.converted_event_id) {
        navigate(`/events/${updated.converted_event_id}/manage`);
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setConverting(false);
    }
  }

  return (
    <form className="idea-convert" onSubmit={(e) => void handleConvert(e)}>
      <div className="idea-convert__heading">
        <h3 className="idea-convert__title">Convert to Event</h3>
        <p className="idea-convert__copy">
          Creates a live calendar event from this approved idea.
          {idea.preferred_timing
            ? ` Preferred timing: ${idea.preferred_timing}.`
            : ""}
        </p>
      </div>

      <div className="idea-convert__fields">
        <label>
          <span>Event name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={converting}
          />
        </label>
        <label>
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
            disabled={converting}
          />
        </label>
        <label>
          <span>Type</span>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            disabled={converting}
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <div className="idea-convert__row">
          <label>
            <span>Date</span>
            <input
              type="date"
              value={eventDate}
              min={getMinEventDate()}
              onChange={(e) => setEventDate(e.target.value)}
              required
              disabled={converting}
            />
          </label>
          <label>
            <span>Time</span>
            <input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              required
              disabled={converting}
            />
          </label>
        </div>
        <label>
          <span>
            Location <em>(optional)</em>
          </span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={converting}
          />
        </label>
        <label>
          <span>Budget</span>
          <input
            type="text"
            inputMode="decimal"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            disabled={converting}
          />
        </label>
      </div>

      {errorMessage ? (
        <p className="idea-workspace-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="idea-convert__actions">
        <Button type="submit" size="sm" loading={converting} disabled={converting}>
          Convert to Event
        </Button>
      </div>
    </form>
  );
}

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
  const isApproved = idea.status === "approved";

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
        {idea.converted_event_id ? (
          <ConvertedLink eventId={idea.converted_event_id} />
        ) : null}
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

      {idea.converted_event_id ? (
        <ConvertedLink eventId={idea.converted_event_id} />
      ) : isApproved ? (
        <ConvertForm idea={idea} onUpdated={onUpdated} />
      ) : (
        <p className="idea-workspace-placeholder">
          Approve this idea to unlock Convert to Event.
        </p>
      )}

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
