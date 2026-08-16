import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

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
import { EVENT_MANAGE_ACTION_LINK } from "../lib/event-manage-ui";
import {
  fetchEventNotificationStatus,
  sendEventRemindersNow,
  type EventDetailResponse,
  type EventNotificationStatus,
} from "../lib/events-api";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { inputFieldClassName } from "./ui/Input";

type EventManageCommunicationsCardProps = {
  event: EventDetailResponse;
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

export function EventManageCommunicationsCard({
  event,
}: EventManageCommunicationsCardProps) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("all_approved");
  const [drafting, setDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [notifStatus, setNotifStatus] = useState<EventNotificationStatus | null>(
    null,
  );
  const [sendingReminder, setSendingReminder] = useState(false);
  const [preview, setPreview] = useState<AnnouncementRecipientPreview | null>(
    null,
  );

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
      setTitle(`${event.name}: event update`);
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
      <section aria-label="Event Communications">
        <div className="event-command-section-head">
          <h2 className="event-command-kicker">Communications</h2>
          <button
            type="button"
            onClick={() => openComposer(true)}
            className={EVENT_MANAGE_ACTION_LINK}
          >
            Compose update
          </button>
        </div>

        {error && !composeOpen ? (
          <p role="alert" className="ds-field-error">
            {error}
          </p>
        ) : null}
        {success && !composeOpen ? (
          <p role="status" className="mt-1 text-sm text-emerald-700">
            {success}
          </p>
        ) : null}

        <dl className="event-command-facts">
          <div>
            <dt>Reminders</dt>
            <dd>
              {notifStatus
                ? reminderLabel(notifStatus.reminder_state)
                : "—"}
            </dd>
          </div>
        </dl>
        {!event.is_past ? (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => void handleSendReminderNow()}
              disabled={sendingReminder}
              className={EVENT_MANAGE_ACTION_LINK}
            >
              {sendingReminder ? "Sending…" : "Send reminder now"}
            </button>
          </div>
        ) : null}

        <div className="mt-4">
          <p className="event-command-kicker">Announcement history</p>
          {historyLoading ? (
            <p className="event-command-stat mt-2">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="event-command-stat mt-2">
              No announcements linked to this event yet.
            </p>
          ) : (
            <ul className="event-command-activity mt-1">
              {history.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-400">
                    {ANNOUNCEMENT_AUDIENCE_LABELS[item.audience]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

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
