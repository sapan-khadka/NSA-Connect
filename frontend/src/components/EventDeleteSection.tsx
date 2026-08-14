import { useState } from "react";
import { useNavigate } from "react-router";

import { getApiErrorMessage } from "../lib/api-error";
import { deleteEvent } from "../lib/events-api";
import { Card } from "./ui/Card";

type EventDeleteSectionProps = {
  eventId: number;
  eventName: string;
  /** Full-width danger zone styling for the manage dashboard. */
  dangerZone?: boolean;
};

export function EventDeleteSection({
  eventId,
  eventName,
  dangerZone = false,
}: EventDeleteSectionProps) {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${eventName}"? This permanently removes the event, RSVPs, tasks, and related records. Finance entries linked to this event will be kept but unlinked. This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteEvent(eventId);
      navigate("/events/calendar", { replace: true });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  if (dangerZone) {
    return (
      <section aria-label="Delete event">
        <div className="event-command-section-head">
          <h2 className="event-command-kicker">Delete event</h2>
        </div>
        <p className="event-command-stat">
          Permanently remove this event and its RSVPs, tasks, invitations, and
          notification history. Linked finance entries stay in the treasury log.
        </p>
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="text-xs font-medium text-overdue hover:text-red-800"
          >
            {isDeleting ? "Deleting…" : "Delete event"}
          </button>
        </div>
        {errorMessage ? (
          <p className="mt-2 text-sm text-overdue" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <Card padding="md" className="border border-overdue/30">
      <h2 className="text-lg font-light tracking-subhead text-foreground">
        Delete event
      </h2>
      <p className="mt-2 text-sm text-label">
        Permanently remove this event and its RSVPs, tasks, invitations, and
        notification history. Linked finance entries stay in the treasury log.
      </p>

      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={isDeleting}
        className="mt-4 rounded-full border border-overdue px-4 py-2 text-sm font-medium text-overdue transition hover:bg-overdue/5 disabled:opacity-60"
      >
        {isDeleting ? "Deleting…" : "Delete event"}
      </button>

      {errorMessage ? (
        <p className="mt-3 text-sm text-overdue" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </Card>
  );
}
