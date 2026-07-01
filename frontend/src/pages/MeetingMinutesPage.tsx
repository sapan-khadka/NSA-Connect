import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { MeetingMinutesSummary } from "../components/MeetingMinutesSummary";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  summarizeMeetingMinutes,
  type SummarizeMinutesResponse,
} from "../lib/ai-api";

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function MeetingMinutesPage() {
  const [meetingTitle, setMeetingTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SummarizeMinutesResponse | null>(null);

  function clearResult() {
    setResult(null);
    setServerError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      setNotesError("Meeting notes are required.");
      return;
    }

    setNotesError(null);
    setServerError(null);
    setIsSubmitting(true);

    try {
      const summary = await summarizeMeetingMinutes({
        notes: trimmedNotes,
        meeting_title: meetingTitle.trim() || undefined,
      });
      setResult(summary);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-light tracking-headline text-foreground">Meeting Minutes</h1>
        <p className="mt-2 max-w-2xl text-label">
          Board meeting notes and attendance are recorded on each meeting event.
          Create a meeting on the{" "}
          <Link to="/events/calendar" className="ds-link">
            events calendar
          </Link>
          , then open it to take attendance and save minutes.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-label">
          You can still use this page to draft a one-off AI summary from pasted
          notes.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-card bg-surface-card p-4 sm:p-6"
      >
        {serverError ? (
          <p
            role="alert"
            className="mb-5 ds-alert-banner"
          >
            {serverError}
          </p>
        ) : null}

        <div className="space-y-5">
          <div>
            <label
              htmlFor="meeting-title"
              className="block text-sm font-medium text-foreground"
            >
              Meeting title{" "}
              <span className="font-normal text-label">(optional)</span>
            </label>
            <input
              id="meeting-title"
              type="text"
              value={meetingTitle}
              onChange={(event) => setMeetingTitle(event.target.value)}
              placeholder="March board meeting"
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="meeting-notes"
              className="block text-sm font-medium text-foreground"
            >
              Raw notes
            </label>
            <textarea
              id="meeting-notes"
              rows={12}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setNotesError(null);
                setServerError(null);
              }}
              placeholder="Paste bullet points, chat logs, or rough notes from the meeting…"
              className={inputClassName}
            />
            {notesError ? (
              <p className="mt-1 ds-field-error">{notesError}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-5">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Summarizing…" : "Summarize minutes"}
          </button>
        </div>
      </form>

      {result ? <MeetingMinutesSummary result={result} onClear={clearResult} /> : null}
    </div>
  );
}
