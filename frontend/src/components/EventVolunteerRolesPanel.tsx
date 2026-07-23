import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchEventVolunteerSlots,
  signupForVolunteerSlot,
  withdrawFromVolunteerSlot,
  type VolunteerSlotResponse,
} from "../lib/events-api";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

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
    return (
      <Card as="div" padding="none" className="p-3">
        <p className="text-sm text-label">Loading volunteer roles…</p>
      </Card>
    );
  }

  if (slots.length === 0) {
    return null;
  }

  return (
    <Card as="div" padding="none" className="p-3">
      <p className="text-sm font-medium text-foreground">Volunteer roles</p>
      <p className="mt-1 text-sm text-label">
        Claim a specific role if you can help.
      </p>
      <ul className="mt-3 space-y-2">
        {slots.map((slot) => {
          const signedUp = Boolean(slot.current_member_signed_up);
          return (
            <li
              key={slot.id}
              className="rounded-lg border border-gray-100 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {slot.task_name}
                  </p>
                  {slot.description?.trim() ? (
                    <p className="mt-0.5 text-xs text-label">
                      {slot.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-label">
                    {slot.signup_count}/{slot.max_signup_count} filled
                    {slot.is_full ? " · Full" : ""}
                  </p>
                </div>
                {canVolunteer ? (
                  signedUp ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busySlotId === slot.id}
                      loading={busySlotId === slot.id}
                      onClick={() => void handleWithdraw(slot.id)}
                    >
                      Withdraw
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={slot.is_full || busySlotId === slot.id}
                      loading={busySlotId === slot.id}
                      onClick={() => void handleClaim(slot.id)}
                    >
                      {slot.is_full ? "Full" : "Claim"}
                    </Button>
                  )
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {errorMessage ? (
        <p role="alert" className="mt-3 ds-field-error">
          {errorMessage}
        </p>
      ) : null}
    </Card>
  );
}
