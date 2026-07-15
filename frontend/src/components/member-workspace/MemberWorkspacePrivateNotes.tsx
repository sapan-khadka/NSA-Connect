/**
 * Private Notes — board+ only. Never mount for general members.
 */

import { useEffect, useId, useState, type FormEvent } from "react";
import { Pin, StickyNote, Trash2 } from "lucide-react";

import { getApiErrorMessage } from "../../lib/auth-api";
import { formatEventDateTime } from "../../lib/format-datetime";
import {
  createMemberNote,
  deleteMemberNote,
  fetchMemberNotes,
  updateMemberNote,
  type MemberNote,
} from "../../lib/member-notes-api";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

type MemberWorkspacePrivateNotesProps = {
  memberId: number;
};

function NotesEmpty() {
  return (
    <div className="member-workspace-resp-empty">
      <p className="member-workspace-resp-empty-title">No private notes yet.</p>
      <p className="member-workspace-docs-empty-desc">
        Notes are visible only to officers — never to this member.
      </p>
    </div>
  );
}

export function MemberWorkspacePrivateNotes({
  memberId,
}: MemberWorkspacePrivateNotesProps) {
  const draftId = useId();
  const [notes, setNotes] = useState<MemberNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pinNew, setPinNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchMemberNotes(memberId)
      .then((result) => {
        if (!cancelled) {
          setNotes(result.notes);
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
  }, [memberId]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSaving) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const created = await createMemberNote(memberId, {
        content,
        pinned: pinNew,
      });
      setNotes((prev) => {
        const next = [created, ...prev.filter((row) => row.id !== created.id)];
        return next.sort((a, b) => {
          if (a.pinned !== b.pinned) {
            return a.pinned ? -1 : 1;
          }
          return b.updated_at.localeCompare(a.updated_at);
        });
      });
      setDraft("");
      setPinNew(false);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePin = async (note: MemberNote) => {
    if (togglingId != null) {
      return;
    }
    setTogglingId(note.id);
    setError(null);
    try {
      const updated = await updateMemberNote(memberId, note.id, {
        pinned: !note.pinned,
      });
      setNotes((prev) =>
        prev
          .map((row) => (row.id === updated.id ? updated : row))
          .sort((a, b) => {
            if (a.pinned !== b.pinned) {
              return a.pinned ? -1 : 1;
            }
            return b.updated_at.localeCompare(a.updated_at);
          }),
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
      await deleteMemberNote(memberId, noteId);
      setNotes((prev) => prev.filter((row) => row.id !== noteId));
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      className="member-workspace-card member-workspace-card--compact member-workspace-notes"
      aria-label="Private Notes"
    >
      <div className="member-workspace-card-header">
        <div className="member-workspace-card-heading">
          <span className="member-workspace-card-icon" aria-hidden="true">
            <AppIcon icon={StickyNote} size="sm" className="text-current" />
          </span>
          <div className="min-w-0">
            <h2 className="member-workspace-card-title">Private Notes</h2>
            <p className="member-workspace-card-desc">
              Officer-only — never visible to this member.
            </p>
          </div>
        </div>
      </div>

      <div className="member-workspace-card-body">
        <form className="member-workspace-notes-form" onSubmit={handleCreate}>
          <label className="sr-only" htmlFor={draftId}>
            New private note
          </label>
          <textarea
            id={draftId}
            className="member-workspace-notes-input"
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a private note…"
            disabled={isSaving}
          />
          <div className="member-workspace-notes-form-row">
            <label className="member-workspace-notes-pin-label">
              <input
                type="checkbox"
                checked={pinNew}
                onChange={(event) => setPinNew(event.target.checked)}
                disabled={isSaving}
              />
              Pin note
            </label>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || !draft.trim()}
            >
              {isSaving ? "Saving…" : "Add note"}
            </Button>
          </div>
        </form>

        {error ? (
          <p className="ds-field-error" role="alert">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <p className="member-workspace-resp-loading">Loading notes…</p>
        ) : null}

        {!isLoading && notes.length === 0 ? <NotesEmpty /> : null}

        {!isLoading && notes.length > 0 ? (
          <ul className="member-workspace-notes-list">
            {notes.map((note) => (
              <li key={note.id} className="member-workspace-notes-item">
                <div className="member-workspace-notes-item-main">
                  {note.pinned ? (
                    <span className="member-workspace-notes-badge">Pinned</span>
                  ) : null}
                  <p className="member-workspace-notes-content">{note.content}</p>
                  <p className="member-workspace-notes-meta">
                    {note.author_name} · {formatEventDateTime(note.updated_at)}
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
        ) : null}
      </div>
    </section>
  );
}
