import { useState, type FormEvent } from "react";

import { MeetingMinutesSummary } from "./MeetingMinutesSummary";
import { getApiErrorMessage } from "../lib/auth-api";
import type { MeetingMinutes } from "../lib/meetings-api";
import type { SummarizeMinutesResponse } from "../lib/ai-api";

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

type MeetingMinutesEditorProps = {
  eventName: string;
  minutes: MeetingMinutes;
  canManage: boolean;
  onSaveNotes: (rawNotes: string) => Promise<MeetingMinutes>;
  onSummarize: (rawNotes: string) => Promise<MeetingMinutes & SummarizeMinutesResponse>;
};

function MinutesStatusChip({
  published,
  draftSaved,
}: {
  published: boolean;
  draftSaved: boolean;
}) {
  if (published) {
    return (
      <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">
        Minutes published
      </span>
    );
  }

  if (draftSaved) {
    return (
      <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-foreground">
        Draft saved
      </span>
    );
  }

  return (
    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-label">
      Not published yet
    </span>
  );
}

function OfficialMinutesPlaceholder({
  canManage,
  draftSaved,
}: {
  canManage: boolean;
  draftSaved: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5">
      <p className="text-sm text-label">
        {canManage
          ? draftSaved
            ? "Your draft is saved. When the meeting ends, summarize and publish official minutes for the board."
            : "Official minutes will appear here after you summarize and publish."
          : "No official minutes have been published for this meeting yet."}
      </p>
    </div>
  );
}

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
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const hasPublishedMinutes = Boolean(savedMinutes.summary?.trim());
  const hasDraft = savedMinutes.raw_notes.trim().length > 0;

  const summaryResult = hasPublishedMinutes
    ? {
        summary: savedMinutes.summary!,
        key_decisions: savedMinutes.key_decisions,
        action_items: savedMinutes.action_items,
      }
    : null;

  async function handleSaveNotes(event: FormEvent) {
    event.preventDefault();
    setNotesError(null);
    setServerError(null);
    setSaveSuccess(null);
    setIsSaving(true);

    try {
      const updated = await onSaveNotes(notes);
      setSavedMinutes(updated);
      setSaveSuccess("Draft saved — board members will be notified.");
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSummarize() {
    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      setNotesError("Add draft notes before publishing official minutes.");
      return;
    }

    setNotesError(null);
    setServerError(null);
    setSaveSuccess(null);
    setIsSummarizing(true);

    try {
      const updated = await onSummarize(trimmedNotes);
      setSavedMinutes(updated);
      setNotes(trimmedNotes);
      setSaveSuccess("Official minutes published — board members will be notified.");
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSummarizing(false);
    }
  }

  return (
    <div className="space-y-6">
      <section
        aria-label="Official minutes"
        className="rounded-xl border border-surface-card bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-light tracking-subhead text-foreground">Official minutes</h2>
            <p className="mt-1 text-sm text-label">
              Board-facing record for {eventName}. Published after the secretary
              summarizes draft notes.
            </p>
          </div>
          <MinutesStatusChip
            published={hasPublishedMinutes}
            draftSaved={hasDraft && !hasPublishedMinutes}
          />
        </div>

        <div className="mt-5">
          {summaryResult ? (
            <MeetingMinutesSummary result={summaryResult} />
          ) : (
            <OfficialMinutesPlaceholder
              canManage={canManage}
              draftSaved={hasDraft}
            />
          )}
        </div>

        {hasPublishedMinutes &&
        savedMinutes.updated_by_name &&
        savedMinutes.updated_at ? (
          <p className="mt-4 text-xs text-label">
            Published by {savedMinutes.updated_by_name} on{" "}
            {new Date(savedMinutes.updated_at).toLocaleString()}
          </p>
        ) : null}
      </section>

      {canManage ? (
        <section
          aria-label="Secretary draft notes"
          className="rounded-xl border border-surface-card bg-white p-6 shadow-sm"
        >
          <div>
            <h2 className="text-lg font-light tracking-subhead text-foreground">
              Secretary draft notes
            </h2>
            <p className="mt-1 text-sm text-label">
              Scratchpad for {eventName}. Save drafts during the meeting, then
              publish official minutes when you are done.
            </p>
          </div>

          <form onSubmit={handleSaveNotes} noValidate className="mt-5 space-y-4">
            {serverError ? (
              <p
                role="alert"
                className="ds-alert-banner"
              >
                {serverError}
              </p>
            ) : null}

            {saveSuccess ? (
              <p
                role="status"
                className="ds-alert-banner"
              >
                {saveSuccess}
              </p>
            ) : null}

            <div>
              <label
                htmlFor="meeting-draft-notes"
                className="block text-sm font-medium text-foreground"
              >
                Draft notes
              </label>
              <textarea
                id="meeting-draft-notes"
                rows={10}
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setNotesError(null);
                  setServerError(null);
                  setSaveSuccess(null);
                }}
                placeholder="Agenda items, discussion points, votes, and action items…"
                className={inputClassName}
              />
              {notesError ? (
                <p className="mt-1 ds-field-error">{notesError}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="submit"
                disabled={isSaving || isSummarizing}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                disabled={isSaving || isSummarizing}
                onClick={() => void handleSummarize()}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSummarizing
                  ? "Publishing…"
                  : hasPublishedMinutes
                    ? "Re-publish minutes"
                    : "Summarize & publish minutes"}
              </button>
            </div>
          </form>

          {hasDraft &&
          !hasPublishedMinutes &&
          savedMinutes.updated_by_name &&
          savedMinutes.updated_at ? (
            <p className="mt-4 text-xs text-label">
              Draft last saved by {savedMinutes.updated_by_name} on{" "}
              {new Date(savedMinutes.updated_at).toLocaleString()}
            </p>
          ) : null}
        </section>
      ) : hasDraft ? (
        <details className="rounded-xl border border-surface-card bg-white shadow-sm">
          <summary className="cursor-pointer px-6 py-4 text-sm font-medium text-foreground">
            View secretary&apos;s draft notes
          </summary>
          <div className="border-t border-gray-100 px-6 py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {savedMinutes.raw_notes}
            </p>
            {savedMinutes.updated_by_name && savedMinutes.updated_at ? (
              <p className="mt-4 text-xs text-label">
                Draft saved by {savedMinutes.updated_by_name} on{" "}
                {new Date(savedMinutes.updated_at).toLocaleString()}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
