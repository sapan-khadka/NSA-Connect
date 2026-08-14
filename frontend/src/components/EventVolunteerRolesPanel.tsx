import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchEventVolunteerSlots,
  signupForVolunteerSlot,
  withdrawFromVolunteerSlot,
  type VolunteerSlotResponse,
} from "../lib/events-api";

type EventVolunteerRolesPanelProps = {
  eventId: number;
  canVolunteer: boolean;
  onSlotsLoaded?: (slotCount: number) => void;
};

export function EventVolunteerRolesPanel({
  eventId,
  canVolunteer,
  onSlotsLoaded,
}: EventVolunteerRolesPanelProps) {
  const [slots, setSlots] = useState<VolunteerSlotResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySlotId, setBusySlotId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadSlots() {
    setLoading(true);
    try {
      const response = await fetchEventVolunteerSlots(eventId);
      setSlots(response.slots);
      onSlotsLoaded?.(response.slots.length);
    } catch {
      setSlots([]);
      onSlotsLoaded?.(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSlots();
  }, [eventId]);

  async function handleClaim(slotId: number) {
    setBusySlotId(slotId);
    setErrorMessage(null);
    try {
      await signupForVolunteerSlot(slotId);
      await loadSlots();
    } catch (caught) {
      setErrorMessage(getApiErrorMessage(caught));
    } finally {
      setBusySlotId(null);
    }
  }

  async function handleWithdraw(slotId: number) {
    setBusySlotId(slotId);
    setErrorMessage(null);
    try {
      await withdrawFromVolunteerSlot(slotId);
      await loadSlots();
    } catch (caught) {
      setErrorMessage(getApiErrorMessage(caught));
    } finally {
      setBusySlotId(null);
    }
  }

  if (loading) {
    return <p className="event-command-stat">Loading volunteer roles…</p>;
  }

  if (slots.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="event-command-section-head">
        <h2 className="event-command-kicker">Volunteer roles</h2>
      </div>
      <p className="event-command-stat">Claim a role if you can help.</p>
      <ul className="event-page-list">
        {slots.map((slot) => {
          const signedUp = Boolean(slot.current_member_signed_up);
          return (
            <li key={slot.id} className="event-page-list-row">
              <div className="min-w-0">
                <p className="event-page-list-title">{slot.task_name}</p>
                {slot.description?.trim() ? (
                  <p className="event-command-stat">{slot.description}</p>
                ) : null}
                <p className="event-command-stat">
                  {slot.signup_count}/{slot.max_signup_count} filled
                  {slot.is_full ? " · Full" : ""}
                </p>
              </div>
              {canVolunteer ? (
                signedUp ? (
                  <button
                    type="button"
                    className="event-command-btn"
                    disabled={busySlotId === slot.id}
                    onClick={() => void handleWithdraw(slot.id)}
                  >
                    {busySlotId === slot.id ? "Updating…" : "Withdraw"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="event-command-btn event-command-btn--primary"
                    disabled={slot.is_full || busySlotId === slot.id}
                    onClick={() => void handleClaim(slot.id)}
                  >
                    {busySlotId === slot.id
                      ? "Claiming…"
                      : slot.is_full
                        ? "Full"
                        : "Claim"}
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      {errorMessage ? (
        <p role="alert" className="mt-3 ds-field-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
