import { useState, type FormEvent } from "react";

import { MeetingMinutesSummary } from "./MeetingMinutesSummary";
import { getApiErrorMessage } from "../lib/auth-api";
import type { MeetingMinutes } from "../lib/meetings-api";
import type { SummarizeMinutesResponse } from "../lib/ai-api";

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

type MeetingMinutesEditorProps = {
  eventName: string;
  minutes: MeetingMinutes;
  canManage: boolean;
  onSaveNotes: (rawNotes: string) => Promise<MeetingMinutes>;
  onSummarize: (rawNotes: string) => Promise<MeetingMinutes & SummarizeMinutesResponse>;
};

export function MeetingMinutesEditor({
  eventName,
  minutes,
  canManage,
  onSaveNotes,
  onSummarize,
}: MeetingMinutesEditorProps) {
  const [notes, setNotes] = useState(minutes.raw_notes);
  const [savedMinutes, setSavedMinutes] = useState(minutes);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const summaryResult =
    savedMinutes.summary
      ? {
          summary: savedMinutes.summary,
          key_decisions: savedMinutes.key_decisions,
          action_items: savedMinutes.action_items,
        }
      : null;

  async function handleSaveNotes(event: FormEvent) {
    event.preventDefault();
    setNotesError(null);
    setServerError(null);
    setIsSaving(true);

    try {
      const updated = await onSaveNotes(notes);
      setSavedMinutes(updated);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSummarize() {
    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      setNotesError("Meeting notes are required before summarizing.");
      return;
    }

    setNotesError(null);
    setServerError(null);
    setIsSummarizing(true);

    try {
      const updated = await onSummarize(trimmedNotes);
      setSavedMinutes(updated);
      setNotes(trimmedNotes);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSummarizing(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-primary">Meeting minutes</h2>
        <p className="mt-1 text-sm text-gray-500">
          Secretary notes for {eventName}. Save raw notes, then summarize with AI
          when the meeting ends.
        </p>
      </div>

      {canManage ? (
        <form onSubmit={handleSaveNotes} noValidate className="mt-5 space-y-4">
          {serverError ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {serverError}
            </p>
          ) : null}

          <div>
            <label
              htmlFor="meeting-raw-notes"
              className="block text-sm font-medium text-primary"
            >
              Raw notes
            </label>
            <textarea
              id="meeting-raw-notes"
              rows={10}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setNotesError(null);
                setServerError(null);
              }}
              placeholder="Agenda items, discussion points, votes, and action items…"
              className={inputClassName}
            />
            {notesError ? (
              <p className="mt-1 text-sm text-red-600">{notesError}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="submit"
              disabled={isSaving || isSummarizing}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-primary transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save notes"}
            </button>
            <button
              type="button"
              disabled={isSaving || isSummarizing}
              onClick={() => void handleSummarize()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSummarizing ? "Summarizing…" : "Summarize minutes"}
            </button>
          </div>
        </form>
      ) : savedMinutes.raw_notes ? (
        <div className="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4">
          <p className="whitespace-pre-wrap text-sm text-gray-700">
            {savedMinutes.raw_notes}
          </p>
        </div>
      ) : (
        <p className="mt-5 text-sm text-gray-500">
          No minutes recorded yet for this meeting.
        </p>
      )}

      {summaryResult ? (
        <div className="mt-6">
          <MeetingMinutesSummary
            result={summaryResult}
            onClear={() =>
              setSavedMinutes((current) => ({
                ...current,
                summary: null,
                key_decisions: [],
                action_items: [],
              }))
            }
          />
        </div>
      ) : null}

      {savedMinutes.updated_by_name && savedMinutes.updated_at ? (
        <p className="mt-4 text-xs text-gray-500">
          Last updated by {savedMinutes.updated_by_name} on{" "}
          {new Date(savedMinutes.updated_at).toLocaleString()}
        </p>
      ) : null}
    </section>
  );
}
