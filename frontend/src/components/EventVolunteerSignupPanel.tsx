import { useState, type FormEvent } from "react";

import { getApiErrorMessage } from "../lib/api-error";
import type { EventVolunteerSignup } from "../lib/events-api";
import {
  volunteerForEvent,
  withdrawVolunteerSignup,
} from "../lib/events-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { inputFieldClassName } from "./ui/Input";

type EventVolunteerSignupPanelProps = {
  eventId: number;
  canVolunteer: boolean;
  signup: EventVolunteerSignup | null;
  onSignupChange: (signup: EventVolunteerSignup | null) => void;
};

export function EventVolunteerSignupPanel({
  eventId,
  canVolunteer,
  signup,
  onSignupChange,
}: EventVolunteerSignupPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canShowNewRequest = canVolunteer && !signup && !showForm;
  const canShowForm =
    canVolunteer &&
    showForm &&
    (!signup || signup.status === "rejected");
  const canShowStatus = Boolean(signup) && !canShowForm;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const created = await volunteerForEvent(eventId, note);
      onSignupChange(created);
      setShowForm(false);
      setNote("");
    } catch (caught) {
      setErrorMessage(getApiErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw() {
    setWithdrawing(true);
    setErrorMessage(null);

    try {
      await withdrawVolunteerSignup(eventId);
      onSignupChange(null);
      setShowForm(false);
      setNote("");
    } catch (caught) {
      setErrorMessage(getApiErrorMessage(caught));
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div>
      <div className="event-command-section-head">
        <h2 className="event-command-kicker">Volunteer</h2>
      </div>

      {!canVolunteer ? (
        <p className="event-command-stat">
          {signup
            ? "You're signed up to help. Volunteer signups are closed for past events."
            : "Volunteer signups are closed for past events."}
        </p>
      ) : null}

      {canShowNewRequest ? (
        <>
          <p className="event-command-stat">
            Let organizers know you can help with setup, cleanup, or other
            tasks. Requests need approval before tasks are assigned.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="event-command-btn event-command-btn--primary mt-3"
          >
            Volunteer
          </button>
        </>
      ) : null}

      {canShowForm ? (
        <form className="mt-3 space-y-3" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block text-sm text-label">
            Optional note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder='e.g. "I can help with decoration"'
              className={`${inputFieldClassName} mt-1`}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="event-command-btn event-command-btn--primary"
            >
              {submitting
                ? "Submitting…"
                : signup?.status === "rejected"
                  ? "Submit again"
                  : "Submit"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setShowForm(false);
                setNote("");
                setErrorMessage(null);
              }}
              className="event-command-btn"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {canShowStatus && signup ? (
        <div className="event-page-note">
          <p className="event-page-list-title">
            {signup.status === "approved"
              ? "You're approved to volunteer"
              : signup.status === "rejected"
                ? "Volunteer request declined"
                : "Volunteer request pending"}
          </p>
          <p className="event-command-stat">
            {signup.status === "pending"
              ? "Organizers will review your request."
              : signup.status === "rejected"
                ? "You can submit again with an updated note."
                : "You can be assigned tasks for this event."}{" "}
            Signed up {formatEventDateTime(signup.created_at)}
          </p>
          {signup.note ? (
            <p className="event-page-description">{signup.note}</p>
          ) : null}
          {canVolunteer && signup.status !== "rejected" ? (
            <button
              type="button"
              onClick={() => void handleWithdraw()}
              disabled={withdrawing}
              className="event-command-btn mt-3"
            >
              {withdrawing ? "Updating…" : "Withdraw"}
            </button>
          ) : null}
          {canVolunteer && signup.status === "rejected" ? (
            <button
              type="button"
              onClick={() => {
                setShowForm(true);
                setNote(signup.note ?? "");
              }}
              className="event-command-btn event-command-btn--primary mt-3"
            >
              Request again
            </button>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="mt-3 ds-field-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
