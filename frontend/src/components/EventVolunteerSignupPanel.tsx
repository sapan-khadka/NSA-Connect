import { useState, type FormEvent } from "react";

import { getApiErrorMessage } from "../lib/api-error";
import type { EventVolunteerSignup } from "../lib/events-api";
import {
  volunteerForEvent,
  withdrawVolunteerSignup,
} from "../lib/events-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
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
    <Card as="div" padding="none" className="p-3">
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
          <Button
            type="button"
            onClick={() => setShowForm(true)}
            size="lg"
            className="mt-3 w-full sm:w-auto"
          >
            Volunteer for this event
          </Button>
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
              className={`${inputFieldClassName} mt-1`}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="submit"
              disabled={submitting}
              loading={submitting}
              size="lg"
              className="w-full sm:w-auto"
            >
              Submit volunteer signup
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                setShowForm(false);
                setNote("");
                setErrorMessage(null);
              }}
              size="lg"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleWithdraw()}
              disabled={withdrawing}
              loading={withdrawing}
              size="lg"
              className="mt-3 w-full sm:w-auto"
            >
              Withdraw signup
            </Button>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="mt-3 ds-field-error">
          {errorMessage}
        </p>
      ) : null}
    </Card>
  );
}
