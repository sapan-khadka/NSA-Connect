import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { MeetingMinutesSummary } from "../components/MeetingMinutesSummary";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, TextArea } from "../components/ui/Input";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  summarizeMeetingMinutes,
  type SummarizeMinutesResponse,
} from "../lib/ai-api";

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

      <Card
        as="form"
        onSubmit={handleSubmit}
        noValidate
        padding="none"
        className="p-4 sm:p-6"
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
          <Input
            id="meeting-title"
            label={
              <>
                Meeting title{" "}
                <span className="font-normal text-label">(optional)</span>
              </>
            }
            type="text"
            value={meetingTitle}
            onChange={(event) => setMeetingTitle(event.target.value)}
            placeholder="March board meeting"
          />

          <TextArea
            id="meeting-notes"
            label="Raw notes"
            rows={12}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setNotesError(null);
              setServerError(null);
            }}
            placeholder="Paste bullet points, chat logs, or rough notes from the meeting…"
            error={notesError}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-5">
          <Button
            type="submit"
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            Summarize minutes
          </Button>
        </div>
      </Card>

      {result ? <MeetingMinutesSummary result={result} onClear={clearResult} /> : null}
    </div>
  );
}
