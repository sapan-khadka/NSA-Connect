import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import {
  fetchEventInvitedParticipants,
  removeEventInvitedParticipant,
  type EventParticipantInvitation,
} from "../lib/events-api";
import { Card } from "./ui/Card";

type EventInvitedParticipantsSectionProps = {
  eventId: number;
  refreshKey?: number;
};

export function EventInvitedParticipantsSection({
  eventId,
  refreshKey = 0,
}: EventInvitedParticipantsSectionProps) {
  const [invitations, setInvitations] = useState<EventParticipantInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchEventInvitedParticipants(eventId)
      .then((response) => {
        if (!cancelled) {
          setInvitations(response.invitations);
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
  }, [eventId, refreshKey]);

  async function handleRemove(memberId: number) {
    setRemovingMemberId(memberId);
    setError(null);
    try {
      await removeEventInvitedParticipant(eventId, memberId);
      setInvitations((current) =>
        current.filter((invitation) => invitation.member_id !== memberId),
      );
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setRemovingMemberId(null);
    }
  }

  return (
    <Card padding="md">
      <h2 className="text-lg font-light tracking-subhead text-foreground">
        Invited participants
      </h2>
      <p className="mt-1 text-sm text-label">
        Members invited to participate in this event&apos;s cultural program.
      </p>

      {error ? <p className="mt-4 ds-field-error">{error}</p> : null}
      {isLoading ? <p className="mt-4 text-sm text-label">Loading invites…</p> : null}

      {!isLoading && invitations.length === 0 ? (
        <p className="mt-4 text-sm text-label">No invited participants yet.</p>
      ) : null}

      {invitations.length > 0 ? (
        <ul className="mt-4 divide-y divide-gray-200">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div>
                <p className="font-medium text-foreground">{invitation.member_name}</p>
                <p className="text-xs text-label">
                  Invited by {invitation.invited_by_name}
                </p>
              </div>
              <button
                type="button"
                disabled={removingMemberId === invitation.member_id}
                onClick={() => void handleRemove(invitation.member_id)}
                className="text-sm text-label hover:text-foreground disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
