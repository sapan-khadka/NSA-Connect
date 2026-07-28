import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { inputFieldClassName } from "./ui/Input";
import { Modal } from "./ui/Modal";
import { fieldLabelClassName } from "../design-system/components/fieldStyles";
import { getApiErrorMessage } from "../lib/api-error";
import { combineDateAndTime, getMinEventDate } from "../lib/event-form";
import { EVENT_TYPE_LABELS, EVENT_TYPES, type EventType } from "../lib/event-types";
import {
  DEFAULT_FEEDBACK_PACKAGE,
  FEEDBACK_PACKAGE_OPTIONS,
  type IdeaFeedbackPackage,
} from "../lib/event-suggestion-polish-api";
import {
  convertEventSuggestion,
  reviewEventSuggestion,
  type BoardUpdatableIdeaStatus,
  type EventSuggestion,
  type IdeaCommunityVisibility,
} from "../lib/event-suggestions-api";
import {
  getDecisionReadiness,
  ideaWorkflowStageLabel,
} from "../lib/idea-workspace-metrics";
import { IdeaBoardAssistantSection } from "./IdeaBoardAssistantSection";

function formatNoteEditedAt(isoDate: string): string {
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return "";
  const date = new Date(parsed);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayDiff = Math.round(
    (startToday.getTime() - startThat.getTime()) / 86_400_000,
  );
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function ConvertForm({
  idea,
  onUpdated,
}: {
  idea: EventSuggestion;
  onUpdated: (updated: EventSuggestion) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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
    if (converting) return;
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

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Convert to Event
      </Button>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void handleConvert(e)}>
      <p className="text-sm text-label">
        Creates a calendar event from this approved idea.
        {idea.preferred_timing
          ? ` Preferred timing: ${idea.preferred_timing}.`
          : ""}
      </p>

      <label className="block">
        <span className={fieldLabelClassName}>Event name</span>
        <input
          type="text"
          className={`${inputFieldClassName} mt-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={converting}
        />
      </label>
      <label className="block">
        <span className={fieldLabelClassName}>Description</span>
        <textarea
          className={`${inputFieldClassName} mt-1`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          required
          disabled={converting}
        />
      </label>
      <label className="block">
        <span className={fieldLabelClassName}>Type</span>
        <select
          className={`${inputFieldClassName} mt-1`}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={fieldLabelClassName}>Date</span>
          <input
            type="date"
            className={`${inputFieldClassName} mt-1`}
            value={eventDate}
            min={getMinEventDate()}
            onChange={(e) => setEventDate(e.target.value)}
            required
            disabled={converting}
          />
        </label>
        <label className="block">
          <span className={fieldLabelClassName}>Time</span>
          <input
            type="time"
            className={`${inputFieldClassName} mt-1`}
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            required
            disabled={converting}
          />
        </label>
      </div>
      <label className="block">
        <span className={fieldLabelClassName}>Location</span>
        <input
          type="text"
          className={`${inputFieldClassName} mt-1`}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={converting}
        />
      </label>
      <label className="block">
        <span className={fieldLabelClassName}>Budget</span>
        <input
          type="text"
          inputMode="decimal"
          className={`${inputFieldClassName} mt-1`}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          disabled={converting}
        />
      </label>

      {errorMessage ? (
        <p className="ds-field-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          className="text-sm font-medium text-label transition hover:text-foreground disabled:opacity-60"
          disabled={converting}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
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
  const [noteOpen, setNoteOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishStep, setPublishStep] = useState<1 | 2>(1);
  const [publishVisibility, setPublishVisibility] =
    useState<IdeaCommunityVisibility>("members");
  const [feedbackPackage, setFeedbackPackage] = useState<IdeaFeedbackPackage>(
    DEFAULT_FEEDBACK_PACKAGE,
  );
  const [savingNote, setSavingNote] = useState(false);
  const [actingStatus, setActingStatus] =
    useState<BoardUpdatableIdeaStatus | null>(null);
  const [closingFeedback, setClosingFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setNote(idea.board_note ?? "");
    setNoteOpen(false);
  }, [idea.id, idea.board_note]);

  const busy = savingNote || actingStatus !== null || closingFeedback;
  const noteDirty = note.trim() !== (idea.board_note ?? "").trim();
  const isConverted = idea.status === "converted";
  const isApproved = idea.status === "approved";
  const feedbackOpen =
    idea.status === "published" && idea.community_feedback_closed_at == null;
  const feedbackClosed =
    idea.status === "published" && idea.community_feedback_closed_at != null;

  async function saveNote() {
    if (busy || !idea.can_board_review) return;
    setSavingNote(true);
    setErrorMessage(null);
    try {
      onUpdated(
        await reviewEventSuggestion(idea.id, {
          board_note: note.trim() || null,
        }),
      );
      setNoteOpen(false);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSavingNote(false);
    }
  }

  async function setFeedbackClosed(closed: boolean) {
    if (busy || !idea.can_board_review || idea.status !== "published") return;
    setClosingFeedback(true);
    setErrorMessage(null);
    try {
      onUpdated(
        await reviewEventSuggestion(idea.id, {
          community_feedback_closed: closed,
        }),
      );
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setClosingFeedback(false);
    }
  }

  async function applyStatus(
    status: BoardUpdatableIdeaStatus,
    packagePayload?: IdeaFeedbackPackage,
    visibility?: IdeaCommunityVisibility,
  ) {
    if (busy || !idea.can_board_review) return;
    if (isConverted && status !== "archived") return;
    setActingStatus(status);
    setErrorMessage(null);
    try {
      const payload: Parameters<typeof reviewEventSuggestion>[1] = { status };
      if (noteDirty) {
        payload.board_note = note.trim() || null;
      }
      if (packagePayload) {
        payload.feedback_package = {
          ...packagePayload,
          discussion: true,
        };
      }
      if (visibility) {
        payload.community_visibility = visibility;
      }
      onUpdated(await reviewEventSuggestion(idea.id, payload));
      setPublishOpen(false);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setActingStatus(null);
    }
  }

  const isRejected = idea.status === "rejected";
  const isArchived = idea.status === "archived";
  const isSubmitted = idea.status === "submitted";
  const isInternal = idea.status === "internal_review";
  const isPublished = idea.status === "published";
  const readiness = getDecisionReadiness(idea);

  const decisionActions = !isConverted ? (
    <section
      className="idea-board-actions idea-board-actions--sticky"
      aria-labelledby="idea-board-actions"
    >
      <h3
        id="idea-board-actions"
        className="text-xs font-semibold uppercase tracking-wide text-label"
      >
        Decision
      </h3>
      <div className="idea-board-actions__primary">
        {isSubmitted ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            loading={actingStatus === "internal_review"}
            onClick={() => void applyStatus("internal_review")}
          >
            Start review
          </Button>
        ) : null}
        {isInternal ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => {
              setFeedbackPackage(DEFAULT_FEEDBACK_PACKAGE);
              setPublishStep(1);
              setPublishVisibility("members");
              setPublishOpen(true);
            }}
          >
            Open for Community Review
          </Button>
        ) : null}
        {isPublished ? (
          <>
            {feedbackOpen ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                loading={closingFeedback}
                onClick={() => void setFeedbackClosed(true)}
              >
                {readiness.status === "ready"
                  ? "Move to Board Decision"
                  : "Close feedback"}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                loading={actingStatus === "approved"}
                onClick={() => void applyStatus("approved")}
              >
                Approve
              </Button>
            )}
          </>
        ) : null}
        {isRejected || isArchived ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            loading={actingStatus === "approved"}
            onClick={() => void applyStatus("approved")}
          >
            Approve anyway
          </Button>
        ) : null}
        {isApproved ? (
          <ConvertForm idea={idea} onUpdated={onUpdated} />
        ) : null}
      </div>
      <div className="idea-board-actions__meta">
        {feedbackClosed ? (
          <button
            type="button"
            className="text-sm font-medium text-label transition hover:text-foreground disabled:opacity-60"
            disabled={busy}
            onClick={() => void setFeedbackClosed(false)}
          >
            {closingFeedback ? "Reopening…" : "Reopen feedback"}
          </button>
        ) : null}
        {isPublished ? (
          <button
            type="button"
            className="text-sm font-medium text-label transition hover:text-foreground disabled:opacity-60"
            disabled={busy}
            onClick={() => void applyStatus("internal_review")}
          >
            {actingStatus === "internal_review"
              ? "Returning…"
              : "Return to Internal Review"}
          </button>
        ) : null}
        {(isInternal || isPublished || isApproved || isRejected) &&
        !isArchived ? (
          <button
            type="button"
            className="text-sm font-medium text-label transition hover:text-foreground disabled:opacity-60"
            disabled={busy}
            onClick={() => void applyStatus("archived")}
          >
            {actingStatus === "archived" ? "Archiving…" : "Archive"}
          </button>
        ) : null}
        {!isRejected && !isConverted ? (
          <button
            type="button"
            className="text-sm font-medium text-red-700 transition hover:underline disabled:opacity-60"
            disabled={busy}
            onClick={() => void applyStatus("rejected")}
          >
            {actingStatus === "rejected" ? "Rejecting…" : "Reject"}
          </button>
        ) : null}
      </div>
    </section>
  ) : null;

  return (
    <Card
      padding="none"
      className="idea-ws-card idea-board-review"
      aria-labelledby="idea-board-decision-card"
    >
      <div className="idea-board-review__body space-y-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="idea-board-decision-card"
            className="text-sm font-semibold uppercase tracking-wide text-label"
          >
            Board review
          </h2>
          <p className="text-xs text-label">Officers only</p>
        </div>

        <section aria-labelledby="idea-board-stage">
          <h3
            id="idea-board-stage"
            className="text-xs font-semibold uppercase tracking-wide text-label"
          >
            Current stage
          </h3>
          <p className="mt-1 text-base font-semibold text-foreground">
            {ideaWorkflowStageLabel(idea)}
          </p>
        </section>

        {(isPublished || isApproved || isConverted || isInternal || isSubmitted) && (
          <IdeaBoardAssistantSection idea={idea} />
        )}

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

        <section
          className="idea-pinned-note"
          aria-labelledby="idea-board-notes"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="idea-board-notes" className="idea-pinned-note__label">
              Internal notes
            </h3>
            {!noteOpen ? (
              <button
                type="button"
                className="text-xs font-medium text-amber-800 hover:underline"
                onClick={() => setNoteOpen(true)}
              >
                {idea.board_note?.trim() ? "Edit" : "Add note"}
              </button>
            ) : null}
          </div>
          {noteOpen ? (
            <div className="mt-2 space-y-2">
              <textarea
                className={`${inputFieldClassName} idea-pinned-note__editor`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder={
                  "Budget available: $350\nNeed university room approval.\nPossible collaboration with ISA."
                }
                disabled={busy}
                aria-label="Internal notes"
                autoFocus
              />
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  className="text-sm font-medium text-label transition hover:text-foreground disabled:opacity-60"
                  disabled={busy}
                  onClick={() => {
                    setNote(idea.board_note ?? "");
                    setNoteOpen(false);
                  }}
                >
                  Cancel
                </button>
                {noteDirty ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    loading={savingNote}
                    onClick={() => void saveNote()}
                  >
                    Save note
                  </Button>
                ) : null}
              </div>
            </div>
          ) : idea.board_note?.trim() ? (
            <div className="idea-pinned-note__body">
              <p className="idea-pinned-note__text">{idea.board_note}</p>
              {idea.board_note_updated_by || idea.board_note_updated_at ? (
                <p className="idea-pinned-note__meta">
                  {idea.board_note_updated_by
                    ? `Last edited by ${idea.board_note_updated_by.full_name}`
                    : "Last edited"}
                  {idea.board_note_updated_at
                    ? ` · ${formatNoteEditedAt(idea.board_note_updated_at)}`
                    : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-amber-900/60">
              Capture budget, room needs, and collaboration notes here.
            </p>
          )}
        </section>

        {errorMessage ? (
          <p className="ds-field-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>

      {decisionActions}

      <Modal
        open={publishOpen}
        title={
          publishStep === 1
            ? "Open for Community Review — Feedback"
            : "Open for Community Review — Visibility"
        }
        onClose={() => {
          if (!busy) setPublishOpen(false);
        }}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs font-medium text-label">
            Step {publishStep} of 2
          </p>
          {publishStep === 1 ? (
            <>
              <p className="text-sm text-label">
                What feedback do you want from the community?
              </p>
              <ul className="space-y-2.5">
                {FEEDBACK_PACKAGE_OPTIONS.map((option) => (
                  <li key={option.key}>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={feedbackPackage[option.key]}
                        disabled={busy}
                        onChange={(event) =>
                          setFeedbackPackage((current) => ({
                            ...current,
                            [option.key]: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        <span className="font-medium text-foreground">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-label">
                          {option.hint}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  className="text-sm font-medium text-label hover:text-foreground disabled:opacity-60"
                  disabled={busy}
                  onClick={() => setPublishOpen(false)}
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => setPublishStep(2)}
                >
                  Next
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-label">
                Who can see and respond to this idea once it is published?
              </p>
              <ul className="space-y-2">
                {(
                  [
                    {
                      value: "everyone" as const,
                      label: "Everyone",
                      hint: "All approved members can participate",
                    },
                    {
                      value: "members" as const,
                      label: "Members only",
                      hint: "Standard membership access",
                    },
                    {
                      value: "active_members" as const,
                      label: "Active members",
                      hint: "Members marked active this semester",
                    },
                    {
                      value: "officers" as const,
                      label: "Officers only",
                      hint: "Keep feedback private to the board",
                    },
                  ] as const
                ).map((option) => (
                  <li key={option.value}>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="radio"
                        className="mt-0.5"
                        name="publish-visibility"
                        checked={publishVisibility === option.value}
                        disabled={busy}
                        onChange={() => setPublishVisibility(option.value)}
                      />
                      <span>
                        <span className="font-medium text-foreground">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-label">
                          {option.hint}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  className="text-sm font-medium text-label hover:text-foreground disabled:opacity-60"
                  disabled={busy}
                  onClick={() => setPublishStep(1)}
                >
                  Back
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="text-sm font-medium text-label hover:text-foreground disabled:opacity-60"
                    disabled={busy}
                    onClick={() => setPublishOpen(false)}
                  >
                    Cancel
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    loading={actingStatus === "published"}
                    onClick={() =>
                      void applyStatus(
                        "published",
                        feedbackPackage,
                        publishVisibility,
                      )
                    }
                  >
                    Open review
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </Card>
  );
}
