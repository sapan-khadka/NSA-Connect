/**
 * Announcements — application list (Linear × Members directory rhythm).
 * Compact rows, aligned meta columns, hover actions. No cards / badges.
 */

import {
  AlertTriangle,
  Calendar,
  Megaphone,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import {
  ANNOUNCEMENT_AUDIENCE_LABELS,
  ANNOUNCEMENT_CATEGORY_FEED_LABELS,
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  updateAnnouncement,
  type Announcement,
  type AnnouncementCategory,
} from "../lib/announcements-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { isRoleAtLeast } from "../lib/roles";
import { AppIcon } from "../components/ui/AppIcon";
import { Button } from "../components/ui/Button";
import { inputFieldClassName } from "../components/ui/Input";
import { Drawer } from "../design-system/components/feedback/Drawer";

const CATEGORY_OPTIONS: { value: AnnouncementCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "urgent", label: "Urgent" },
  { value: "event_related", label: "Event" },
];

const CATEGORY_ICONS = {
  general: Megaphone,
  urgent: AlertTriangle,
  event_related: Calendar,
} as const;

type FeedFilter = "all" | "pinned" | AnnouncementCategory;

function formatFeedTimestamp(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function audienceShortLabel(audience: Announcement["audience"]): string {
  if (audience === "all_approved") {
    return "Everyone";
  }
  if (audience === "going") {
    return "Going";
  }
  if (audience === "maybe") {
    return "Maybe";
  }
  if (audience === "no_rsvp") {
    return "No RSVP";
  }
  return ANNOUNCEMENT_AUDIENCE_LABELS[audience];
}

/** Sentence-case the first character without mangling multi-word titles. */
function displayTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function buildAnnouncementMetaParts(announcement: Announcement): string[] {
  const parts = [announcement.author.full_name];
  if (announcement.audience !== "all_approved") {
    parts.push(audienceShortLabel(announcement.audience));
  }
  parts.push(ANNOUNCEMENT_CATEGORY_FEED_LABELS[announcement.category]);
  return parts;
}

function AnnouncementMeta({
  announcement,
  className,
}: {
  announcement: Announcement;
  className?: string;
}) {
  const parts = buildAnnouncementMetaParts(announcement);
  return (
    <p className={className ?? "announcements-feed-meta"}>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {index > 0 ? (
            <span className="announcements-feed-meta-sep" aria-hidden="true">
              {" "}
              ·{" "}
            </span>
          ) : null}
          <span
            className={
              index === 0
                ? "announcements-feed-meta-author"
                : "announcements-feed-meta-rest"
            }
          >
            {part}
          </span>
        </span>
      ))}
    </p>
  );
}

type AnnouncementFormProps = {
  initial?: Announcement;
  onCancel: () => void;
  onSaved: (announcement: Announcement) => void;
};

function AnnouncementForm({
  initial,
  onCancel,
  onSaved,
}: AnnouncementFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [category, setCategory] = useState<AnnouncementCategory>(
    initial?.category ?? "general",
  );
  const [isPinned, setIsPinned] = useState(initial?.is_pinned ?? false);
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
            is_pinned: isPinned,
          })
        : await createAnnouncement({
            title: trimmedTitle,
            body: trimmedBody,
            category,
            is_pinned: isPinned,
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
      className="announcements-compose"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="announcements-compose-header">
        <h2 className="announcements-compose-title">
          {initial ? "Edit announcement" : "New announcement"}
        </h2>
        <button
          type="button"
          className="announcements-compose-close"
          aria-label="Close composer"
          onClick={onCancel}
        >
          <AppIcon icon={X} size="sm" className="text-current" />
        </button>
      </div>

      {errorMessage ? (
        <p className="announcements-compose-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="announcements-compose-fields">
        <label className="block">
          <span className="announcements-compose-label">Title</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className={`${inputFieldClassName} mt-1`}
          />
        </label>

        <label className="block">
          <span className="announcements-compose-label">Body</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            rows={5}
            className={`${inputFieldClassName} mt-1`}
          />
        </label>

        <label className="block">
          <span className="announcements-compose-label">Category</span>
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as AnnouncementCategory)
            }
            className={`${inputFieldClassName} mt-1`}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="announcements-compose-pin">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(event) => setIsPinned(event.target.checked)}
          />
          Pin to top
        </label>
      </div>

      <div className="announcements-compose-actions">
        <Button type="submit" disabled={submitting} loading={submitting} size="sm">
          {initial ? "Save" : "Post"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} size="sm">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AnnouncementMoreMenu({
  announcement,
  onEdit,
  onDeleted,
  onPinnedChange,
}: {
  announcement: Announcement;
  onEdit: (announcement: Announcement) => void;
  onDeleted: (announcementId: number) => void;
  onPinnedChange: (announcement: Announcement) => void;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: globalThis.MouseEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleDelete() {
    if (
      !window.confirm(`Delete "${announcement.title}"? This cannot be undone.`)
    ) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await deleteAnnouncement(announcement.id);
      onDeleted(announcement.id);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  async function handleTogglePin() {
    setBusy(true);
    setErrorMessage(null);
    try {
      const updated = await updateAnnouncement(announcement.id, {
        is_pinned: !announcement.is_pinned,
      });
      onPinnedChange(updated);
      setOpen(false);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="announcements-feed-more"
      ref={rootRef}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="announcements-feed-more-btn"
        aria-label={`Actions for ${announcement.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <AppIcon icon={MoreHorizontal} size="xs" className="text-current" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="announcements-feed-more-menu"
          aria-label="Announcement actions"
        >
          <button
            type="button"
            role="menuitem"
            className="announcements-feed-more-item"
            onClick={() => {
              setOpen(false);
              onEdit(announcement);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="announcements-feed-more-item"
            disabled={busy}
            onClick={() => {
              void handleTogglePin();
            }}
          >
            {announcement.is_pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="announcements-feed-more-item is-danger"
            disabled={busy}
            onClick={() => {
              void handleDelete();
            }}
          >
            {busy ? "Working…" : "Delete"}
          </button>
        </div>
      ) : null}
      {errorMessage ? (
        <p className="announcements-feed-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function AnnouncementFeedItem({
  announcement,
  canManage,
  onOpen,
  onEdit,
  onDeleted,
  onPinnedChange,
}: {
  announcement: Announcement;
  canManage: boolean;
  onOpen: (announcement: Announcement) => void;
  onEdit: (announcement: Announcement) => void;
  onDeleted: (announcementId: number) => void;
  onPinnedChange: (announcement: Announcement) => void;
}) {
  const CategoryIcon = announcement.is_pinned
    ? Pin
    : CATEGORY_ICONS[announcement.category];
  const categoryLabel = announcement.is_pinned
    ? "Pinned"
    : ANNOUNCEMENT_CATEGORY_FEED_LABELS[announcement.category];

  function handleActivate() {
    onOpen(announcement);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleActivate();
    }
  }

  return (
    <article
      className={[
        "announcements-feed-item",
        announcement.is_pinned ? "is-pinned" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="button"
      tabIndex={0}
      aria-label={`Open ${displayTitle(announcement.title)}`}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
    >
      <div className="announcements-feed-item-top">
        <div className="announcements-feed-title-group">
          <span
            className="announcements-feed-icon"
            aria-label={categoryLabel}
            title={categoryLabel}
          >
            <AppIcon icon={CategoryIcon} size="xs" className="text-current" />
          </span>
          <h2 className="announcements-feed-title">
            {displayTitle(announcement.title)}
          </h2>
        </div>
        <div className="announcements-feed-item-end">
          <time
            className="announcements-feed-date"
            dateTime={announcement.created_at}
            title={formatEventDateTime(announcement.created_at)}
          >
            {formatFeedTimestamp(announcement.created_at)}
          </time>
          {canManage ? (
            <AnnouncementMoreMenu
              announcement={announcement}
              onEdit={onEdit}
              onDeleted={onDeleted}
              onPinnedChange={onPinnedChange}
            />
          ) : (
            <span className="announcements-feed-more-spacer" aria-hidden="true" />
          )}
        </div>
      </div>

      <p className="announcements-feed-body">{announcement.body}</p>
      <AnnouncementMeta announcement={announcement} />
    </article>
  );
}

function AnnouncementReader({
  announcement,
  open,
  onClose,
}: {
  announcement: Announcement | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!announcement) {
    return null;
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="md"
      showClose
      title={
        <span className="announcements-reader-drawer-title">
          {displayTitle(announcement.title)}
        </span>
      }
    >
      <div className="announcements-reader">
        <AnnouncementMeta announcement={announcement} />
        <p className="announcements-reader-body">{announcement.body}</p>

        {announcement.event_id ? (
          <Link
            to={`/events/${announcement.event_id}`}
            className="announcements-reader-event"
          >
            View related event
          </Link>
        ) : null}
      </div>
    </Drawer>
  );
}

export function AnnouncementsPage() {
  const { member } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);
  const [openAnnouncement, setOpenAnnouncement] = useState<Announcement | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FeedFilter>("all");

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

  useEffect(() => {
    if (!canManage || searchParams.get("create") !== "1") {
      return;
    }
    setEditingAnnouncement(null);
    setOpenAnnouncement(null);
    setShowCreateForm(true);
    navigate("/announcements", { replace: true });
  }, [canManage, navigate, searchParams]);

  useEffect(() => {
    if (!canManage) {
      return;
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "n") {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setEditingAnnouncement(null);
      setOpenAnnouncement(null);
      setShowCreateForm(true);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [canManage]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return announcements.filter((item) => {
      if (filter === "pinned" && !item.is_pinned) {
        return false;
      }
      if (
        filter !== "all" &&
        filter !== "pinned" &&
        item.category !== filter
      ) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        item.title,
        item.body,
        item.author.full_name,
        ANNOUNCEMENT_CATEGORY_FEED_LABELS[item.category],
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [announcements, filter, search]);

  const pinnedItems = useMemo(
    () => filtered.filter((item) => item.is_pinned),
    [filtered],
  );
  const recentItems = useMemo(
    () => filtered.filter((item) => !item.is_pinned),
    [filtered],
  );
  const showPinnedSection =
    filter !== "pinned" && pinnedItems.length > 0 && recentItems.length > 0;

  function upsertAnnouncement(saved: Announcement) {
    setAnnouncements((current) => {
      const without = current.filter((item) => item.id !== saved.id);
      return [saved, ...without].sort((left, right) => {
        if (left.is_pinned !== right.is_pinned) {
          return left.is_pinned ? -1 : 1;
        }
        return (
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime()
        );
      });
    });
    setOpenAnnouncement((current) =>
      current?.id === saved.id ? saved : current,
    );
  }

  function handleSaved(saved: Announcement) {
    upsertAnnouncement(saved);
    setShowCreateForm(false);
    setEditingAnnouncement(null);
  }

  function handleEdit(announcement: Announcement) {
    setOpenAnnouncement(null);
    setShowCreateForm(false);
    setEditingAnnouncement(announcement);
  }

  function handleDeleted(announcementId: number) {
    setAnnouncements((current) =>
      current.filter((item) => item.id !== announcementId),
    );
    setOpenAnnouncement((current) =>
      current?.id === announcementId ? null : current,
    );
  }

  const composing = showCreateForm || editingAnnouncement !== null;

  function renderItems(items: Announcement[]) {
    return items.map((announcement) => (
      <AnnouncementFeedItem
        key={announcement.id}
        announcement={announcement}
        canManage={canManage}
        onOpen={setOpenAnnouncement}
        onEdit={handleEdit}
        onDeleted={handleDeleted}
        onPinnedChange={upsertAnnouncement}
      />
    ));
  }

  return (
    <div className="announcements-page">
      <header className="announcements-page-header">
        <div className="announcements-page-heading">
          <div className="announcements-page-title-row">
            <h1 className="announcements-page-title">Announcements</h1>
            {canManage && !composing ? (
              <button
                type="button"
                className="announcements-page-new"
                onClick={() => {
                  setEditingAnnouncement(null);
                  setOpenAnnouncement(null);
                  setShowCreateForm(true);
                }}
              >
                <AppIcon icon={Plus} size="xs" className="text-current" />
                Announcement
              </button>
            ) : null}
          </div>
          <p className="announcements-page-subtitle">
            Organization-wide updates, reminders, and event notices.
          </p>
        </div>
      </header>

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

      {!composing ? (
        <div className="announcements-toolbar">
          <label className="announcements-search">
            <AppIcon icon={Search} size="xs" className="text-current" />
            <span className="sr-only">Search announcements</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search announcements"
            />
          </label>

          <div
            className="announcements-filters"
            role="group"
            aria-label="Filter announcements"
          >
            {(
              [
                { value: "all", label: "All" },
                { value: "pinned", label: "Pinned" },
                { value: "event_related", label: "Events" },
                { value: "urgent", label: "Urgent" },
                { value: "general", label: "General" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                className={filter === option.value ? "is-active" : undefined}
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="announcements-page-alert" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <p className="announcements-page-empty">Loading announcements…</p>
      ) : filtered.length === 0 ? (
        announcements.length === 0 ? (
          <div className="announcements-page-empty-state">
            <p className="announcements-page-empty-title">No announcements yet</p>
            <p className="announcements-page-empty-copy">
              Create your first announcement to keep members informed.
            </p>
            {canManage ? (
              <button
                type="button"
                className="announcements-page-empty-action"
                onClick={() => {
                  setEditingAnnouncement(null);
                  setOpenAnnouncement(null);
                  setShowCreateForm(true);
                }}
              >
                <AppIcon icon={Plus} size="xs" className="text-current" />
                Create announcement
              </button>
            ) : null}
          </div>
        ) : (
          <p className="announcements-page-empty">
            No announcements match your filters.
          </p>
        )
      ) : (
        <div className="announcements-feed" role="feed" aria-label="Announcements">
          {showPinnedSection ? (
            <>
              <section className="announcements-feed-section" aria-label="Pinned">
                <h2 className="announcements-feed-section-title">
                  <AppIcon icon={Pin} size="xs" className="text-current" />
                  Pinned
                </h2>
                {renderItems(pinnedItems)}
              </section>
              <section className="announcements-feed-section" aria-label="Recent">
                <h2 className="announcements-feed-section-title">Recent</h2>
                {renderItems(recentItems)}
              </section>
            </>
          ) : (
            renderItems(filtered)
          )}
        </div>
      )}

      <AnnouncementReader
        announcement={openAnnouncement}
        open={openAnnouncement !== null}
        onClose={() => setOpenAnnouncement(null)}
      />
    </div>
  );
}
