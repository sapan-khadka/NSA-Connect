import { useState, type FormEvent } from "react";

import { MeetingMinutesSummary } from "../components/MeetingMinutesSummary";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  summarizeMeetingMinutes,
  type SummarizeMinutesResponse,
} from "../lib/ai-api";

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

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
        <h1 className="text-3xl font-bold text-primary">Meeting Minutes</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Paste raw board meeting notes and get a structured summary with key
          decisions and action items.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6"
      >
        {serverError ? (
          <p
            role="alert"
            className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {serverError}
          </p>
        ) : null}

        <div className="space-y-5">
          <div>
            <label
              htmlFor="meeting-title"
              className="block text-sm font-medium text-primary"
            >
              Meeting title{" "}
              <span className="font-normal text-gray-500">(optional)</span>
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
              className="block text-sm font-medium text-primary"
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
              <p className="mt-1 text-sm text-red-600">{notesError}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-5">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Summarizing…" : "Summarize minutes"}
          </button>
        </div>
      </form>

      {result ? <MeetingMinutesSummary result={result} onClear={clearResult} /> : null}
    </div>
  );
}
