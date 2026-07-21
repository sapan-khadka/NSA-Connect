import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Link2, Megaphone, Sparkles } from "lucide-react";

import { getApiErrorMessage } from "../lib/api-error";
import { draftAnnouncementEmail } from "../lib/ai-api";
import {
  ANNOUNCEMENT_AUDIENCE_LABELS,
  createAnnouncement,
  fetchAnnouncementRecipientPreview,
  fetchAnnouncements,
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementRecipientPreview,
} from "../lib/announcements-api";
import {
  eventDetailPath,
  publicEventPath,
} from "../lib/event-links";
import {
  EVENT_MANAGE_EYEBROW,
  EVENT_MANAGE_PRIMARY_BTN,
  EVENT_MANAGE_SECONDARY_BTN,
  EVENT_MANAGE_SECTION_CARD_CLASS,
  EVENT_MANAGE_SECTION_SUBTITLE,
  EVENT_MANAGE_SECTION_TITLE,
} from "../lib/event-manage-ui";
import {
  fetchEventNotificationStatus,
  sendEventRemindersNow,
  type EventDetailResponse,
  type EventNotificationStatus,
} from "../lib/events-api";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";
import { HomeCard } from "./ui/HomeCard";
import { Modal } from "./ui/Modal";
import { inputFieldClassName } from "./ui/Input";

type EventManageCommunicationsCardProps = {
  event: EventDetailResponse;
  canSharePublicly: boolean;
};

const AUDIENCE_OPTIONS: AnnouncementAudience[] = [
  "all_approved",
  "going",
  "maybe",
  "no_rsvp",
];

function reminderLabel(state: EventNotificationStatus["reminder_state"]): string {
  switch (state) {
    case "sent":
      return "Sent";
    case "scheduled":
      return "Scheduled (~24h before)";
    case "due_soon":
      return "Due in the automated window";
    case "past":
      return "Event has passed";
    default:
      return "Not applicable";
  }
}

function nudgeLabel(state: EventNotificationStatus["nudge_state"]): string {
  switch (state) {
    case "sent":
      return "Sent";
    case "scheduled":
      return "Scheduled (~48h before)";
    case "due_soon":
      return "Due in the automated window";
    case "past":
      return "Event has passed";
    default:
      return "Not applicable";
  }
}

export function EventManageCommunicationsCard({
  event,
  canSharePublicly,
}: EventManageCommunicationsCardProps) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("all_approved");
  const [drafting, setDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [notifStatus, setNotifStatus] = useState<EventNotificationStatus | null>(
    null,
  );
  const [sendingReminder, setSendingReminder] = useState(false);
  const [preview, setPreview] = useState<AnnouncementRecipientPreview | null>(
    null,
  );

  const publicPath = publicEventPath(event.id);
  const memberPath = eventDetailPath(event.id);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const response = await fetchAnnouncements({ event_id: event.id });
      setHistory(response.announcements);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadNotificationStatus() {
    try {
      setNotifStatus(await fetchEventNotificationStatus(event.id));
    } catch {
      setNotifStatus(null);
    }
  }

  useEffect(() => {
    void loadHistory();
    void loadNotificationStatus();
  }, [event.id]);

  useEffect(() => {
    if (!composeOpen) {
      return;
    }
    let cancelled = false;
    void fetchAnnouncementRecipientPreview({
      audience,
      event_id: event.id,
    })
      .then((response) => {
        if (!cancelled) {
          setPreview(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [composeOpen, audience, event.id]);

  function openComposer(prefill = true) {
    setError(null);
    setSuccess(null);
    if (prefill && !title && !body) {
      setTitle(`${event.name} — event update`);
      setBody(
        [
          `Hi NSA members,`,
          ``,
          `Here's an update about ${event.name}.`,
          event.location?.trim()
            ? `Location: ${event.location.trim()}`
            : null,
          ``,
          event.description.trim(),
          ``,
          `See details in NSA Connect.`,
        ]
          .filter((line) => line !== null)
          .join("\n"),
      );
    }
    setComposeOpen(true);
  }

  async function handleDraftWithAi() {
    setDrafting(true);
    setError(null);
    setSuccess(null);
    try {
      const draft = await draftAnnouncementEmail({
        event_name: event.name,
        event_type: event.event_type,
        starts_at: event.starts_at,
        ...(event.location?.trim() ? { location: event.location.trim() } : {}),
        description: event.description,
      });
      setTitle(draft.subject);
      setBody(draft.body);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setDrafting(false);
    }
  }

  async function handlePublish() {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      setError("Title and body are required.");
      return;
    }

    setPublishing(true);
    setError(null);
    setSuccess(null);
    try {
      await createAnnouncement({
        title: trimmedTitle,
        body: trimmedBody,
        category: "event_related",
        audience,
        event_id: event.id,
      });
      setSuccess(
        `Announcement published to ${ANNOUNCEMENT_AUDIENCE_LABELS[audience].toLowerCase()}.`,
      );
      setTitle("");
      setBody("");
      setAudience("all_approved");
      await loadHistory();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setPublishing(false);
    }
  }

  async function handleCopyPublicLink() {
    const url = `${window.location.origin}${publicPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setShareCopied(false);
    }
  }

  async function handleSendReminderNow() {
    if (
      !window.confirm(
        "Send a reminder email now to Going and Maybe RSVPs who haven't already received one?",
      )
    ) {
      return;
    }
    setSendingReminder(true);
    setError(null);
    try {
      const result = await sendEventRemindersNow(event.id);
      setSuccess(
        `Reminder sent to ${result.sent} member${result.sent === 1 ? "" : "s"} (${result.skipped} skipped).`,
      );
      await loadNotificationStatus();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setSendingReminder(false);
    }
  }

  return (
    <>
      <HomeCard
        padding="md"
        className={EVENT_MANAGE_SECTION_CARD_CLASS}
        aria-label="Event Communications"
      >
        <div>
          <h2 className={EVENT_MANAGE_SECTION_TITLE}>Communications</h2>
          <p className={EVENT_MANAGE_SECTION_SUBTITLE}>
            Share the public page and send targeted member announcements.
          </p>
        </div>

        {error && !composeOpen ? (
          <p role="alert" className="mt-3 ds-field-error">
            {error}
          </p>
        ) : null}
        {success && !composeOpen ? (
          <p role="status" className="mt-3 text-sm text-emerald-700">
            {success}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white px-3.5 py-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                <AppIcon icon={Link2} size="sm" className="text-current" />
              </span>
              <div className="min-w-0">
                <p className={EVENT_MANAGE_EYEBROW}>Public share link</p>
                {canSharePublicly ? (
                  <>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">
                      {publicPath}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCopyPublicLink()}
                      className={`mt-3 ${EVENT_MANAGE_SECONDARY_BTN}`}
                    >
                      {shareCopied ? "Link copied" : "Copy public link"}
                    </button>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-gray-600">
                    Closed board meetings are not publicly shareable. Use{" "}
                    <Link to={memberPath} className="font-medium text-primary">
                      the member event page
                    </Link>
                    .
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white px-3.5 py-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                <AppIcon icon={Bell} size="sm" className="text-current" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={EVENT_MANAGE_EYEBROW}>Reminders</p>
                {notifStatus ? (
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-gray-600">
                    <li>
                      RSVP nudge: {nudgeLabel(notifStatus.nudge_state)}
                      {notifStatus.nudge_sent_count > 0
                        ? ` (${notifStatus.nudge_sent_count} sent)`
                        : ""}
                    </li>
                    <li>
                      Event reminder: {reminderLabel(notifStatus.reminder_state)}
                      {notifStatus.reminder_sent_count > 0
                        ? ` (${notifStatus.reminder_sent_count} sent)`
                        : ""}
                    </li>
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">
                    Automated RSVP nudge ~48h and reminder ~24h before start.
                  </p>
                )}
                {!event.is_past ? (
                  <button
                    type="button"
                    onClick={() => void handleSendReminderNow()}
                    disabled={sendingReminder}
                    className={`mt-3 ${EVENT_MANAGE_SECONDARY_BTN}`}
                  >
                    {sendingReminder ? "Sending…" : "Send reminder now"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gray-100 bg-white px-3.5 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                <AppIcon icon={Megaphone} size="sm" className="text-current" />
              </span>
              <div>
                <p className={EVENT_MANAGE_EYEBROW}>Targeted announcement</p>
                <p className="mt-1 text-sm text-gray-600">
                  Email and inbox notify Going, Maybe, no-RSVP, or everyone.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openComposer(true)}
              className={EVENT_MANAGE_PRIMARY_BTN}
            >
              Compose update
            </button>
          </div>
        </div>

        <div className="mt-5">
          <p className={EVENT_MANAGE_EYEBROW}>Event announcement history</p>
          {historyLoading ? (
            <p className="mt-2 text-sm text-gray-500">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No announcements linked to this event yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100">
              {history.slice(0, 5).map((item) => (
                <li key={item.id} className="px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {ANNOUNCEMENT_AUDIENCE_LABELS[item.audience]} ·{" "}
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </HomeCard>

      <Modal
        open={composeOpen}
        title="Announce event update"
        onClose={() => setComposeOpen(false)}
        size="lg"
      >
        <div className="space-y-4">
          {error ? (
            <p role="alert" className="ds-field-error">
              {error}
            </p>
          ) : null}
          {success ? (
            <p role="status" className="text-sm text-emerald-700">
              {success}
            </p>
          ) : null}

          <div>
            <label
              htmlFor="event-announce-audience"
              className="block text-xs font-medium text-gray-500"
            >
              Audience
            </label>
            <select
              id="event-announce-audience"
              value={audience}
              onChange={(changeEvent) =>
                setAudience(changeEvent.target.value as AnnouncementAudience)
              }
              className={`${inputFieldClassName} mt-1`}
            >
              {AUDIENCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {ANNOUNCEMENT_AUDIENCE_LABELS[option]}
                </option>
              ))}
            </select>
            {preview ? (
              <p className="mt-1.5 text-xs text-gray-500">
                About {preview.emailable} member
                {preview.emailable === 1 ? "" : "s"} will get email (of{" "}
                {preview.total} in audience).
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="event-announce-title"
              className="block text-xs font-medium text-gray-500"
            >
              Title
            </label>
            <input
              id="event-announce-title"
              type="text"
              value={title}
              onChange={(changeEvent) => setTitle(changeEvent.target.value)}
              className={`${inputFieldClassName} mt-1`}
            />
          </div>

          <div>
            <label
              htmlFor="event-announce-body"
              className="block text-xs font-medium text-gray-500"
            >
              Body
            </label>
            <textarea
              id="event-announce-body"
              rows={8}
              value={body}
              onChange={(changeEvent) => setBody(changeEvent.target.value)}
              className={`${inputFieldClassName} mt-1 resize-y`}
            />
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              loading={drafting}
              disabled={drafting || publishing}
              onClick={() => void handleDraftWithAi()}
            >
              <span className="inline-flex items-center gap-1.5">
                <AppIcon icon={Sparkles} size="xs" className="text-current" />
                Draft with AI
              </span>
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setComposeOpen(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                loading={publishing}
                disabled={publishing || drafting}
                onClick={() => void handlePublish()}
              >
                Publish announcement
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
