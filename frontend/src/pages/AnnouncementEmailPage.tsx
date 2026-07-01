import { useState, type FormEvent } from "react";

import { AnnouncementEmailDraft } from "../components/AnnouncementEmailDraft";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  draftAnnouncementEmail,
  type DraftAnnouncementEmailResponse,
} from "../lib/ai-api";
import { combineDateAndTime } from "../lib/event-form";
import { EVENT_TYPE_LABELS, EVENT_TYPES, type EventType } from "../lib/event-types";

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function AnnouncementEmailPage() {
  const [eventName, setEventName] = useState("");
  const [eventNameError, setEventNameError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [eventType, setEventType] = useState<EventType>("cultural");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState<DraftAnnouncementEmailResponse | null>(null);

  function clearDraft() {
    setDraft(null);
    setServerError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = eventName.trim();
    if (!trimmedName) {
      setEventNameError("Event name is required.");
      return;
    }

    setEventNameError(null);
    setServerError(null);
    setIsSubmitting(true);

    try {
      const response = await draftAnnouncementEmail({
        event_name: trimmedName,
        ...(showDetails && {
          event_type: eventType,
          ...(eventDate
            ? { starts_at: combineDateAndTime(eventDate, eventTime) }
            : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
        }),
      });
      setDraft(response);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-light tracking-headline text-foreground">Announcement Email</h1>
        <p className="mt-2 max-w-2xl text-label">
          Enter an event name and generate a ready-to-send member announcement
          with subject line and formatted body.
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
            <label htmlFor="event-name" className="block text-sm font-medium text-foreground">
              Event name
            </label>
            <input
              id="event-name"
              type="text"
              value={eventName}
              onChange={(event) => {
                setEventName(event.target.value);
                setEventNameError(null);
                setServerError(null);
              }}
              placeholder="Dashain Celebration"
              className={inputClassName}
            />
            {eventNameError ? (
              <p className="mt-1 ds-field-error">{eventNameError}</p>
            ) : null}
          </div>

          <div className="rounded-card bg-surface-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Event details</h2>
                <p className="mt-1 text-sm text-label">
                  Optional — improves date, location, and tone in the draft.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails((current) => !current)}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:bg-accent/5"
              >
                {showDetails ? "Hide details" : "Add details"}
              </button>
            </div>

            {showDetails ? (
              <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
                <div>
                  <label
                    htmlFor="announcement-event-type"
                    className="block text-sm font-medium text-foreground"
                  >
                    Event type
                  </label>
                  <select
                    id="announcement-event-type"
                    value={eventType}
                    onChange={(event) =>
                      setEventType(event.target.value as EventType)
                    }
                    className={inputClassName}
                  >
                    {EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {EVENT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="announcement-event-date"
                      className="block text-sm font-medium text-foreground"
                    >
                      Date
                    </label>
                    <input
                      id="announcement-event-date"
                      type="date"
                      value={eventDate}
                      onChange={(event) => setEventDate(event.target.value)}
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="announcement-event-time"
                      className="block text-sm font-medium text-foreground"
                    >
                      Start time
                    </label>
                    <input
                      id="announcement-event-time"
                      type="time"
                      value={eventTime}
                      onChange={(event) => setEventTime(event.target.value)}
                      className={inputClassName}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="announcement-location"
                    className="block text-sm font-medium text-foreground"
                  >
                    Location
                  </label>
                  <input
                    id="announcement-location"
                    type="text"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="University Center Ballroom"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label
                    htmlFor="announcement-description"
                    className="block text-sm font-medium text-foreground"
                  >
                    Description
                  </label>
                  <textarea
                    id="announcement-description"
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Brief notes about food, dress code, or what members should expect…"
                    className={inputClassName}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-5">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Generating draft…" : "Generate email draft"}
          </button>
        </div>
      </form>

      {draft ? <AnnouncementEmailDraft draft={draft} onClear={clearDraft} /> : null}
    </div>
  );
}
