import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  updateAnnouncement,
  type Announcement,
  type AnnouncementCategory,
} from "../lib/announcements-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { isRoleAtLeast } from "../lib/roles";

const CATEGORY_OPTIONS: { value: AnnouncementCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "urgent", label: "Urgent" },
  { value: "event_related", label: "Event-related" },
];

function categoryBadgeClass(category: AnnouncementCategory): string {
  if (category === "urgent") {
    return "bg-overdue/10 text-overdue";
  }
  if (category === "event_related") {
    return "bg-accent/10 text-accent";
  }
  return "bg-gray-100 text-label";
}

type AnnouncementFormProps = {
  initial?: Announcement;
  onCancel: () => void;
  onSaved: (announcement: Announcement) => void;
};

function AnnouncementForm({ initial, onCancel, onSaved }: AnnouncementFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [category, setCategory] = useState<AnnouncementCategory>(
    initial?.category ?? "general",
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      setErrorMessage("Title and body are required.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const saved = initial
        ? await updateAnnouncement(initial.id, {
            title: trimmedTitle,
            body: trimmedBody,
            category,
          })
        : await createAnnouncement({
            title: trimmedTitle,
            body: trimmedBody,
            category,
          });
      onSaved(saved);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="rounded-xl border border-gray-200 bg-surface-card p-6"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <h2 className="text-lg font-light tracking-subhead text-foreground">
        {initial ? "Edit announcement" : "Post announcement"}
      </h2>
      <p className="mt-1 text-sm text-label">
        {initial
          ? "Update this announcement. Emails are only sent when a new announcement is posted."
          : "All members with announcement emails enabled will be notified immediately."}
      </p>

      {errorMessage ? (
        <p className="mt-4 text-sm text-overdue" role="alert">
          {errorMessage}
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
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Body</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            rows={5}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as AnnouncementCategory)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-accent px-5 py-2 text-sm text-white disabled:opacity-60"
        >
          {submitting ? "Saving…" : initial ? "Save changes" : "Post announcement"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-gray-200 px-5 py-2 text-sm text-label"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function AnnouncementCard({
  announcement,
  canManage,
  onEdit,
  onDeleted,
}: {
  announcement: Announcement;
  canManage: boolean;
  onEdit: (announcement: Announcement) => void;
  onDeleted: (announcementId: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${announcement.title}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    setErrorMessage(null);
    try {
      await deleteAnnouncement(announcement.id);
      onDeleted(announcement.id);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium text-foreground">
              {announcement.title}
            </h2>
            <span
              className={[
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                categoryBadgeClass(announcement.category),
              ].join(" ")}
            >
              {ANNOUNCEMENT_CATEGORY_LABELS[announcement.category]}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {announcement.body}
          </p>
        </div>
        {canManage ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onEdit(announcement)}
              className="text-sm text-accent hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="text-sm text-overdue hover:underline disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-3 text-sm text-overdue" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <p className="mt-4 text-xs text-label">
        Posted by {announcement.author.full_name} ·{" "}
        {formatEventDateTime(announcement.created_at)}
      </p>
    </article>
  );
}

export function AnnouncementsPage() {
  const { member } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(
    null,
  );

  const canManage = member ? isRoleAtLeast(member.role, "board") : false;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetchAnnouncements();
        if (!cancelled) {
          setAnnouncements(response.announcements);
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

  function handleSaved(saved: Announcement) {
    setAnnouncements((current) => {
      const without = current.filter((item) => item.id !== saved.id);
      return [saved, ...without].sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      );
    });
    setShowCreateForm(false);
    setEditingAnnouncement(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light tracking-headline text-foreground">
            Announcements
          </h1>
          <p className="mt-2 text-sm text-label">
            Updates and broadcasts from the NSA board.
          </p>
        </div>
        {canManage && !showCreateForm && !editingAnnouncement ? (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="rounded-full bg-accent px-5 py-2 text-sm text-white"
          >
            Post announcement
          </button>
        ) : null}
      </div>

      {canManage && showCreateForm ? (
        <AnnouncementForm
          onCancel={() => setShowCreateForm(false)}
          onSaved={handleSaved}
        />
      ) : null}

      {canManage && editingAnnouncement ? (
        <AnnouncementForm
          initial={editingAnnouncement}
          onCancel={() => setEditingAnnouncement(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {errorMessage ? (
        <div className="ds-alert-banner p-4 text-sm" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-label">Loading announcements…</p>
      ) : announcements.length === 0 ? (
        <div className="ds-card p-8 text-center">
          <p className="text-sm text-label">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              canManage={canManage}
              onEdit={setEditingAnnouncement}
              onDeleted={(announcementId) =>
                setAnnouncements((current) =>
                  current.filter((item) => item.id !== announcementId),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
