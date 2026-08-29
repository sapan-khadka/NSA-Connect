/**
 * Personal notepad — private reminders for board members.
 */

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Pin, StickyNote, Trash2 } from "lucide-react";

import { getApiErrorMessage } from "../lib/api-error";
import { eventDetailPath } from "../lib/event-links";
import { fetchEvents, type EventResponse } from "../lib/events-api";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  createPersonalNote,
  deletePersonalNote,
  fetchPersonalNotes,
  updatePersonalNote,
  type PersonalNote,
} from "../lib/personal-notepad-api";
import { AppIcon } from "../components/ui/AppIcon";
import { inputFieldClassName } from "../components/ui/Input";

function sortNotes(notes: PersonalNote[]): PersonalNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return b.updated_at.localeCompare(a.updated_at);
  });
}

function formatEventOptionLabel(event: EventResponse): string {
  const date = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(event.starts_at));
  return `${event.name} · ${date}`;
}

export function PersonalNotepadPage() {
  const titleId = useId();
  const contentId = useId();
  const eventId = useId();
  const filterId = useId();

  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [filterEventId, setFilterEventId] = useState<number | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftEventId, setDraftEventId] = useState<number | "">("");
  const [pinNew, setPinNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        const response = await fetchEvents();
        if (!cancelled) {
          setEvents(response.events);
        }
      } catch {
        if (!cancelled) {
          setEvents([]);
        }
      }
    }

    void loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const eventFilter =
      filterEventId === "all" ? undefined : Number(filterEventId);

    void fetchPersonalNotes(eventFilter)
      .then((result) => {
        if (!cancelled) {
          setNotes(sortNotes(result.notes));
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setNotes([]);
          setError(getApiErrorMessage(caught));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filterEventId]);

  const eventOptions = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      ),
    [events],
  );

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const content = draftContent.trim();
    if (!content || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const created = await createPersonalNote({
        title: draftTitle.trim() || null,
        content,
        event_id: draftEventId === "" ? null : Number(draftEventId),
        pinned: pinNew,
      });
      setNotes((prev) => sortNotes([created, ...prev]));
      setDraftTitle("");
      setDraftContent("");
      setDraftEventId("");
      setPinNew(false);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePin = async (note: PersonalNote) => {
    if (togglingId != null) {
      return;
    }
    setTogglingId(note.id);
    setError(null);
    try {
      const updated = await updatePersonalNote(note.id, {
        pinned: !note.pinned,
      });
      setNotes((prev) =>
        sortNotes(prev.map((row) => (row.id === updated.id ? updated : row))),
      );
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (noteId: number) => {
    if (deletingId != null) {
      return;
    }
    setDeletingId(noteId);
    setError(null);
    try {
      await deletePersonalNote(noteId);
      setNotes((prev) => prev.filter((row) => row.id !== noteId));
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="members-page event-command max-w-3xl">
      <header className="members-page-header mb-4">
        <div className="members-page-header-top">
          <div className="min-w-0">
            <div className="ds-icon-label gap-2">
              <AppIcon icon={StickyNote} size="sm" className="text-label" />
              <h1 className="members-page-title">Notepad</h1>
            </div>
            <p className="members-page-meta mt-1">
              Private reminders — only you can see these notes.
            </p>
          </div>
        </div>
      </header>

      <section className="member-workspace-card member-workspace-notes mb-5">
        <form className="member-workspace-notes-form" onSubmit={handleCreate}>
          <div className="space-y-2">
            <label className="sr-only" htmlFor={titleId}>
              Note title
            </label>
            <input
              id={titleId}
              type="text"
              className={inputFieldClassName}
              placeholder="Title (optional)"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              disabled={isSaving}
              maxLength={200}
            />

            <label className="sr-only" htmlFor={contentId}>
              Note content
            </label>
            <textarea
              id={contentId}
              className="member-workspace-notes-input is-expanded"
              rows={4}
              placeholder="Write a reminder about an event, task, or follow-up…"
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              disabled={isSaving}
            />

            <label className="sr-only" htmlFor={eventId}>
              Link to event
            </label>
            <select
              id={eventId}
              className={inputFieldClassName}
              value={draftEventId}
              onChange={(event) => {
                const value = event.target.value;
                setDraftEventId(value === "" ? "" : Number(value));
              }}
              disabled={isSaving}
            >
              <option value="">Link to event (optional)</option>
              {eventOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatEventOptionLabel(item)}
                </option>
              ))}
            </select>
          </div>

          <div className="member-workspace-notes-form-row mt-2">
            <label className="member-workspace-notes-pin-label">
              <input
                type="checkbox"
                checked={pinNew}
                onChange={(event) => setPinNew(event.target.checked)}
                disabled={isSaving}
              />
              Pin note
            </label>
            <button
              type="submit"
              className="event-command-btn event-command-btn--primary"
              disabled={isSaving || !draftContent.trim()}
            >
              {isSaving ? "Saving…" : "Add note"}
            </button>
          </div>
        </form>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-label" htmlFor={filterId}>
          Filter
        </label>
        <select
          id={filterId}
          className={`${inputFieldClassName} max-w-xs`}
          value={filterEventId === "all" ? "all" : String(filterEventId)}
          onChange={(event) => {
            const value = event.target.value;
            setFilterEventId(value === "all" ? "all" : Number(value));
          }}
        >
          <option value="all">All notes</option>
          {eventOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {formatEventOptionLabel(item)}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="ds-field-error mb-4" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-label">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-label">No notes yet. Add one above.</p>
      ) : (
        <ul className="member-workspace-notes-list">
          {notes.map((note) => (
            <li key={note.id} className="member-workspace-notes-item">
              <div className="member-workspace-notes-item-main min-w-0">
                {note.pinned ? (
                  <span className="member-workspace-notes-badge">Pinned</span>
                ) : null}
                {note.title ? (
                  <p className="text-sm font-medium text-foreground">
                    {note.title}
                  </p>
                ) : null}
                <p className="member-workspace-notes-content whitespace-pre-wrap">
                  {note.content}
                </p>
                {note.event_id != null && note.event_name ? (
                  <Link
                    to={eventDetailPath(note.event_id)}
                    className="mt-1 inline-block text-xs text-primary hover:underline"
                  >
                    {note.event_name}
                    {note.event_starts_at
                      ? ` · ${formatEventDateTime(note.event_starts_at)}`
                      : null}
                  </Link>
                ) : null}
                <p className="member-workspace-notes-meta">
                  Updated {formatEventDateTime(note.updated_at)}
                </p>
              </div>
              <div className="member-workspace-notes-actions">
                <button
                  type="button"
                  className="member-workspace-notes-action"
                  onClick={() => void handleTogglePin(note)}
                  disabled={togglingId === note.id}
                  aria-label={note.pinned ? "Unpin note" : "Pin note"}
                >
                  <AppIcon icon={Pin} size="sm" className="text-current" />
                </button>
                <button
                  type="button"
                  className="member-workspace-notes-action member-workspace-notes-action--danger"
                  onClick={() => void handleDelete(note.id)}
                  disabled={deletingId === note.id}
                  aria-label="Delete note"
                >
                  <AppIcon icon={Trash2} size="sm" className="text-current" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
