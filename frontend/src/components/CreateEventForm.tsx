import { useState, type FormEvent } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import { EVENT_TYPE_LABELS, EVENT_TYPES } from "../lib/event-types";
import {
  buildCreateEventPayload,
  initialCreateEventValues,
  type CreateEventFormErrors,
  type CreateEventFormValues,
  validateCreateEventField,
  validateCreateEventForm,
} from "../lib/event-form";
import { createEvent, type EventResponse } from "../lib/events-api";

type CreateEventFormProps = {
  onCreated: (event: EventResponse) => void;
};

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function CreateEventForm({ onCreated }: CreateEventFormProps) {
  const [values, setValues] = useState<CreateEventFormValues>(
    initialCreateEventValues,
  );
  const [fieldErrors, setFieldErrors] = useState<CreateEventFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  function updateField<K extends keyof CreateEventFormValues>(
    field: K,
    value: CreateEventFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
  }

  function validateField(field: keyof CreateEventFormValues) {
    const error = validateCreateEventField(field, values[field], values);
    setFieldErrors((current) => ({
      ...current,
      [field]: error ?? undefined,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validateCreateEventForm(values);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      const created = await createEvent(buildCreateEventPayload(values));
      setValues(initialCreateEventValues);
      setIsExpanded(false);
      onCreated(created);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">Create event</h2>
          <p className="mt-1 text-sm text-gray-600">
            Board members can schedule new NSA events.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:border-accent hover:bg-accent/5"
        >
          {isExpanded ? "Hide form" : "New event"}
        </button>
      </div>

      {isExpanded ? (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-5 space-y-5 border-t border-gray-100 pt-5"
        >
          {serverError ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {serverError}
            </p>
          ) : null}

          <div>
            <label htmlFor="event-name" className="block text-sm font-medium text-primary">
              Event name
            </label>
            <input
              id="event-name"
              type="text"
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              onBlur={() => validateField("name")}
              className={inputClassName}
            />
            {fieldErrors.name ? (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="event-description"
              className="block text-sm font-medium text-primary"
            >
              Description
            </label>
            <textarea
              id="event-description"
              rows={4}
              value={values.description}
              onChange={(event) => updateField("description", event.target.value)}
              onBlur={() => validateField("description")}
              className={inputClassName}
            />
            {fieldErrors.description ? (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.description}</p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="event-type"
                className="block text-sm font-medium text-primary"
              >
                Event type
              </label>
              <select
                id="event-type"
                value={values.event_type}
                onChange={(event) =>
                  updateField("event_type", event.target.value as CreateEventFormValues["event_type"])
                }
                onBlur={() => validateField("event_type")}
                className={inputClassName}
              >
                {EVENT_TYPES.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {EVENT_TYPE_LABELS[eventType]}
                  </option>
                ))}
              </select>
              {fieldErrors.event_type ? (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.event_type}</p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="event-budget"
                className="block text-sm font-medium text-primary"
              >
                Budget (USD)
              </label>
              <input
                id="event-budget"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={values.budget}
                onChange={(event) => updateField("budget", event.target.value)}
                onBlur={() => validateField("budget")}
                className={inputClassName}
              />
              {fieldErrors.budget ? (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.budget}</p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="event-date"
                className="block text-sm font-medium text-primary"
              >
                Date
              </label>
              <input
                id="event-date"
                type="date"
                value={values.event_date}
                onChange={(event) => updateField("event_date", event.target.value)}
                onBlur={() => validateField("event_date")}
                className={inputClassName}
              />
              {fieldErrors.event_date ? (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.event_date}</p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="event-time"
                className="block text-sm font-medium text-primary"
              >
                Start time
              </label>
              <input
                id="event-time"
                type="time"
                value={values.event_time}
                onChange={(event) => updateField("event_time", event.target.value)}
                onBlur={() => validateField("event_time")}
                className={inputClassName}
              />
              {fieldErrors.event_time ? (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.event_time}</p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating…" : "Create event"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
