import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import {
  combineDateAndTime,
  getMinEventDate,
  splitEventDateTime,
  validateCreateEventField,
} from "../lib/event-form";
import { patchEvent, type EventDetailResponse } from "../lib/events-api";
import { formatEventDateTime } from "../lib/format-datetime";

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

type EventManageScheduleFieldsProps = {
  event: EventDetailResponse;
  onUpdated: (event: EventDetailResponse) => void;
};

export function EventManageScheduleFields({
  event,
  onUpdated,
}: EventManageScheduleFieldsProps) {
  const initial = splitEventDateTime(event.starts_at);
  const [eventDate, setEventDate] = useState(initial.event_date);
  const [eventTime, setEventTime] = useState(initial.event_time);
  const [dateError, setDateError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const next = splitEventDateTime(event.starts_at);
    setEventDate(next.event_date);
    setEventTime(next.event_time);
    setDateError(null);
    setTimeError(null);
    setServerError(null);
  }, [event.id, event.starts_at]);

  const savedSchedule = splitEventDateTime(event.starts_at);
  const isDirty =
    eventDate !== savedSchedule.event_date || eventTime !== savedSchedule.event_time;

  async function handleSave() {
    const nextDateError = validateCreateEventField("event_date", eventDate, {
      name: event.name,
      description: event.description,
      event_type: event.event_type,
      event_date: eventDate,
      event_time: eventTime,
      budget: "",
    });
    const nextTimeError = validateCreateEventField("event_time", eventTime, {
      name: event.name,
      description: event.description,
      event_type: event.event_type,
      event_date: eventDate,
      event_time: eventTime,
      budget: "",
    });

    setDateError(nextDateError);
    setTimeError(nextTimeError);
    setServerError(null);

    if (nextDateError || nextTimeError) {
      return;
    }

    setIsSaving(true);

    try {
      const updated = await patchEvent(event.id, {
        starts_at: combineDateAndTime(eventDate, eventTime),
      });
      onUpdated({ ...event, ...updated });
    } catch (caught) {
      setServerError(getApiErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="ds-card p-4 sm:p-6">
      <h2 className="text-base font-medium text-foreground">Schedule</h2>
      <p className="mt-1 text-sm text-label">
        Currently scheduled for {formatEventDateTime(event.starts_at)}.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="manage-event-date" className="block text-sm font-medium text-foreground">
            Date
          </label>
          <input
            id="manage-event-date"
            type="date"
            min={getMinEventDate()}
            value={eventDate}
            onChange={(changeEvent) => {
              setEventDate(changeEvent.target.value);
              setDateError(null);
              setServerError(null);
            }}
            className={inputClassName}
          />
          {dateError ? (
            <p className="mt-1 ds-field-error">{dateError}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="manage-event-time" className="block text-sm font-medium text-foreground">
            Start time
          </label>
          <input
            id="manage-event-time"
            type="time"
            value={eventTime}
            onChange={(changeEvent) => {
              setEventTime(changeEvent.target.value);
              setTimeError(null);
              setServerError(null);
            }}
            className={inputClassName}
          />
          {timeError ? (
            <p className="mt-1 ds-field-error">{timeError}</p>
          ) : null}
        </div>
      </div>

      {serverError ? (
        <p role="alert" className="mt-3 ds-field-error">
          {serverError}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!isDirty || isSaving}
          onClick={() => void handleSave()}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save schedule"}
        </button>
      </div>
    </section>
  );
}
