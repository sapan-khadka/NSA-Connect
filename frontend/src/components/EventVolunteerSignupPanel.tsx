import { useState, type FormEvent } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import type { EventVolunteerSignup } from "../lib/events-api";
import {
  volunteerForEvent,
  withdrawVolunteerSignup,
} from "../lib/events-api";
import { formatEventDateTime } from "../lib/format-datetime";

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
    <div className="ds-card p-3">
      <p className="text-sm text-foreground">Volunteer for this event</p>

      {!canVolunteer ? (
        <p className="mt-3 text-sm text-label">
          {signup
            ? "You're signed up to help. Volunteer signups are closed for past events."
            : "Volunteer signups are closed for past events."}
        </p>
      ) : null}

      {canVolunteer && !signup && !showForm ? (
        <>
          <p className="mt-2 text-sm text-label">
            Let organizers know you&apos;d like to help with setup, cleanup, or
            other tasks.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-3 rounded-pill bg-primary px-4 py-2 text-sm text-white transition hover:opacity-90"
          >
            Volunteer for this event
          </button>
        </>
      ) : null}

      {canVolunteer && !signup && showForm ? (
        <form className="mt-3 space-y-3" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block text-sm text-label">
            Optional note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder='e.g. "I can help with decoration" or "available for setup/cleanup"'
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-pill bg-primary px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit volunteer signup"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setShowForm(false);
                setNote("");
                setErrorMessage(null);
              }}
              className="rounded-pill border border-gray-200 px-4 py-2 text-sm text-foreground disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {signup ? (
        <div className="mt-3 rounded-lg border border-accent/20 bg-accent/5 px-3 py-3">
          <p className="text-sm font-medium text-foreground">
            You&apos;re signed up to volunteer
          </p>
          <p className="mt-1 text-xs text-label">
            Signed up {formatEventDateTime(signup.created_at)}
          </p>
          {signup.note ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              {signup.note}
            </p>
          ) : null}
          {canVolunteer ? (
            <button
              type="button"
              onClick={() => void handleWithdraw()}
              disabled={withdrawing}
              className="mt-3 rounded-pill border border-gray-200 px-4 py-2 text-sm text-foreground hover:border-accent disabled:opacity-60"
            >
              {withdrawing ? "Withdrawing…" : "Withdraw signup"}
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
