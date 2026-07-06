import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  createEventSuggestion,
  fetchEventSuggestions,
  markEventSuggestionNoted,
  type EventSuggestion,
} from "../lib/event-suggestions-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { isRoleAtLeast } from "../lib/roles";

const TIMING_SUGGESTIONS = [
  "This semester",
  "Next semester",
  "Fall",
  "Spring",
] as const;

function SuggestionCard({
  suggestion,
  canManage,
  onNoted,
}: {
  suggestion: EventSuggestion;
  canManage: boolean;
  onNoted: (updated: EventSuggestion) => void;
}) {
  const [marking, setMarking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleMarkNoted() {
    setMarking(true);
    setErrorMessage(null);
    try {
      const updated = await markEventSuggestionNoted(suggestion.id);
      onNoted(updated);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setMarking(false);
    }
  }

  const isNoted = suggestion.status === "noted";

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium text-foreground">{suggestion.title}</h2>
            {isNoted ? (
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                Noted
              </span>
            ) : null}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {suggestion.description}
          </p>
          {suggestion.preferred_timing ? (
            <p className="mt-3 text-sm text-label">
              Preferred timing: {suggestion.preferred_timing}
            </p>
          ) : null}
        </div>
        {canManage && !isNoted ? (
          <button
            type="button"
            onClick={() => void handleMarkNoted()}
            disabled={marking}
            className="shrink-0 rounded-full border border-gray-200 px-4 py-2 text-sm text-foreground hover:border-accent disabled:opacity-60"
          >
            {marking ? "Saving…" : "Mark noted"}
          </button>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-3 text-sm text-overdue" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <p className="mt-4 text-xs text-label">
        Suggested by {suggestion.suggested_by.full_name} ·{" "}
        {formatEventDateTime(suggestion.created_at)}
        {isNoted && suggestion.noted_at ? (
          <>
            {" "}
            · Noted {formatEventDateTime(suggestion.noted_at)}
            {suggestion.noted_by ? ` by ${suggestion.noted_by.full_name}` : ""}
          </>
        ) : null}
      </p>
    </article>
  );
}

export function EventSuggestionsPage() {
  const { member } = useAuth();
  const [suggestions, setSuggestions] = useState<EventSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preferredTiming, setPreferredTiming] = useState("");
  const [customTiming, setCustomTiming] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const canManage = member ? isRoleAtLeast(member.role, "board") : false;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetchEventSuggestions();
        if (!cancelled) {
          setSuggestions(response.suggestions);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getApiErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !trimmedDescription) {
      setSubmitError("Title and description are required.");
      return;
    }

    const timingValue =
      preferredTiming === "custom"
        ? customTiming.trim()
        : preferredTiming.trim();

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const created = await createEventSuggestion({
        title: trimmedTitle,
        description: trimmedDescription,
        preferred_timing: timingValue || null,
      });
      setSuggestions((current) => [created, ...current]);
      setTitle("");
      setDescription("");
      setPreferredTiming("");
      setCustomTiming("");
      setShowForm(false);
      setSubmitSuccess("Thanks — your suggestion was submitted.");
    } catch (error) {
      setSubmitError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-card pb-6">
        <div>
          <p className="ds-section-label">Events</p>
          <h1 className="mt-1 text-2xl font-light tracking-headline text-foreground">
            Event suggestions
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-light text-label">
            Share ideas for future NSA events. All members can browse suggestions for inspiration.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((current) => !current);
            setSubmitError(null);
            setSubmitSuccess(null);
          }}
          className="rounded-full bg-accent px-5 py-2 text-sm text-white"
        >
          {showForm ? "Close form" : "Suggest an event"}
        </button>
      </div>

      {submitSuccess ? (
        <div className="rounded-lg ds-card px-4 py-3 text-sm text-primary">
          {submitSuccess}
        </div>
      ) : null}

      {showForm ? (
        <form
          className="ds-card p-6"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <h2 className="text-lg font-light tracking-subhead text-foreground">
            Suggest an event
          </h2>
          <p className="mt-1 text-sm text-label">
            Share a title, what you have in mind, and optional timing preferences.
          </p>

          {submitError ? (
            <p className="mt-4 text-sm text-overdue" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground">Title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="e.g. Spring cultural night"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-foreground">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                rows={5}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="What would this event look like? Why would members enjoy it?"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-foreground">
                Preferred timing <span className="text-label">(optional)</span>
              </span>
              <select
                value={preferredTiming}
                onChange={(event) => setPreferredTiming(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">No preference</option>
                {TIMING_SUGGESTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value="custom">Other (type below)</option>
              </select>
            </label>

            {preferredTiming === "custom" ? (
              <label className="block">
                <span className="text-sm font-medium text-foreground">
                  Your timing idea
                </span>
                <input
                  type="text"
                  value={customTiming}
                  onChange={(event) => setCustomTiming(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="e.g. early March, after midterms"
                />
              </label>
            ) : null}
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-accent px-5 py-2 text-sm text-white disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit suggestion"}
            </button>
          </div>
        </form>
      ) : null}

      {canManage ? (
        <p className="text-sm text-label">
          Board view: mark suggestions as noted when you&apos;ve reviewed them for planning.
        </p>
      ) : null}

      {errorMessage ? (
        <div className="ds-alert-banner p-4 text-sm" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-label">Loading suggestions…</p>
      ) : suggestions.length === 0 ? (
        <div className="ds-card p-8 text-center">
          <p className="text-sm text-label">No suggestions yet.</p>
          <p className="mt-2 text-sm text-label">
            Be the first to{" "}
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-accent hover:underline"
            >
              suggest an event
            </button>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              canManage={canManage}
              onNoted={(updated) =>
                setSuggestions((current) =>
                  current.map((item) => (item.id === updated.id ? updated : item)),
                )
              }
            />
          ))}
        </div>
      )}

      <p className="text-sm text-label">
        <Link to="/events/calendar" className="text-accent hover:underline">
          ← Back to calendar
        </Link>
      </p>
    </div>
  );
}
