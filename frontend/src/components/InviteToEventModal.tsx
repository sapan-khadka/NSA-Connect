import { useEffect, useState } from "react";

import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { getApiErrorMessage } from "../lib/api-error";
import { fetchUpcomingEvents, type EventResponse } from "../lib/events-api";
import { inviteEventParticipants } from "../lib/events-api";

type InviteToEventModalProps = {
  open: boolean;
  memberIds: number[];
  onClose: () => void;
  onInvited?: () => void;
};

export function InviteToEventModal({
  open,
  memberIds,
  onClose,
  onInvited,
}: InviteToEventModalProps) {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setSelectedEventId(null);

    fetchUpcomingEvents({ limit: 50 })
      .then((response) => {
        if (!cancelled) {
          setEvents(response.events);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
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
  }, [open]);

  async function handleInvite() {
    if (!selectedEventId || memberIds.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await inviteEventParticipants(selectedEventId, memberIds);
      setSuccessMessage(
        `Invited ${memberIds.length} member${memberIds.length === 1 ? "" : "s"} to participate.`,
      );
      onInvited?.();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal open={open} title="Invite to event" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-label">
          Associate {memberIds.length} filtered member
          {memberIds.length === 1 ? "" : "s"} as invited participants for an upcoming event.
        </p>

        {isLoading ? <p className="text-sm text-label">Loading events…</p> : null}
        {error ? <p className="ds-field-error">{error}</p> : null}
        {successMessage ? (
          <p className="rounded-lg bg-mint/30 px-3 py-2 text-sm text-primary">
            {successMessage}
          </p>
        ) : null}

        {!isLoading && events.length === 0 ? (
          <p className="text-sm text-label">No upcoming events available.</p>
        ) : null}

        {events.length > 0 ? (
          <label className="block">
            <span className="text-sm font-medium text-foreground">Event</span>
            <select
              value={selectedEventId ?? ""}
              onChange={(event) =>
                setSelectedEventId(
                  event.target.value ? Number(event.target.value) : null,
                )
              }
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground"
            >
              <option value="">Select an event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            disabled={!selectedEventId || isSubmitting || memberIds.length === 0}
            loading={isSubmitting}
            onClick={() => void handleInvite()}
          >
            Send invites
          </Button>
        </div>
      </div>
    </Modal>
  );
}
