import { useState, type FormEvent } from "react";

import { MeetingMinutesSummary } from "./MeetingMinutesSummary";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { inputFieldClassName } from "./ui/Input";
import { getApiErrorMessage } from "../lib/auth-api";
import type { MeetingMinutes } from "../lib/meetings-api";
import type { SummarizeMinutesResponse } from "../lib/ai-api";

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
    return <Badge variant="success">Published</Badge>;
  }

  if (draftSaved) {
    return <Badge variant="neutral">Draft saved</Badge>;
  }

  return <Badge variant="neutral">Not published</Badge>;
}

export function MeetingMinutesEditor({
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
    <Card aria-label="Minutes" padding="md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-light tracking-subhead text-foreground">Minutes</h2>
        <MinutesStatusChip
          published={hasPublishedMinutes}
          draftSaved={hasDraft && !hasPublishedMinutes}
        />
      </div>

      {summaryResult ? (
        <div className="mt-4 border-b border-gray-100 pb-4">
          <MeetingMinutesSummary result={summaryResult} />
          {savedMinutes.updated_by_name && savedMinutes.updated_at ? (
            <p className="mt-3 text-xs text-label">
              Published by {savedMinutes.updated_by_name} on{" "}
              {new Date(savedMinutes.updated_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : null}

      {canManage ? (
        <form onSubmit={handleSaveNotes} noValidate className="mt-4 space-y-4">
          {serverError ? (
            <p role="alert" className="ds-alert-banner">
              {serverError}
            </p>
          ) : null}

          {saveSuccess ? (
            <p role="status" className="ds-alert-banner">
              {saveSuccess}
            </p>
          ) : null}

          <div>
            <label htmlFor="meeting-minutes-notes" className="sr-only">
              Minutes notes
            </label>
            <textarea
              id="meeting-minutes-notes"
              rows={10}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setNotesError(null);
                setServerError(null);
                setSaveSuccess(null);
              }}
              placeholder="Agenda items, discussion points, votes, and action items…"
              className={`${inputFieldClassName} mt-3`}
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
            <Button
              type="button"
              disabled={isSaving || isSummarizing}
              onClick={() => void handleSummarize()}
            >
              {isSummarizing
                ? "Publishing…"
                : hasPublishedMinutes
                  ? "Re-publish"
                  : "Publish"}
            </Button>
          </div>

          {hasDraft &&
          !hasPublishedMinutes &&
          savedMinutes.updated_by_name &&
          savedMinutes.updated_at ? (
            <p className="text-xs text-label">
              Draft last saved by {savedMinutes.updated_by_name} on{" "}
              {new Date(savedMinutes.updated_at).toLocaleString()}
            </p>
          ) : null}
        </form>
      ) : (
        <>
          {!summaryResult && !hasDraft ? (
            <p className="mt-4 text-sm text-label">No minutes published yet.</p>
          ) : null}
          {!summaryResult && hasDraft ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                View secretary&apos;s draft notes
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {savedMinutes.raw_notes}
              </p>
            </details>
          ) : null}
        </>
      )}
    </Card>
  );
}
