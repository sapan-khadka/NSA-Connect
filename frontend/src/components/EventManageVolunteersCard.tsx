import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../lib/api-error";
import type { EventVolunteerSignupMember } from "../lib/events-api";
import {
  createEventVolunteerSlot,
  deleteVolunteerSlot,
  fetchEventVolunteerSlots,
  patchVolunteerSlot,
  type VolunteerSlotResponse,
} from "../lib/events-api";
import { EVENT_MANAGE_ACTION_LINK } from "../lib/event-manage-ui";
import { InviteMembersToEventModal } from "./InviteMembersToEventModal";
import { inputFieldClassName } from "./ui/Input";

type EventManageVolunteersCardProps = {
  eventId: number;
  eventName: string;
  volunteers: EventVolunteerSignupMember[];
  isLoading: boolean;
  alreadyInvitedMemberIds?: number[];
  focusAddRoleToken?: number;
  onViewSignups: () => void;
  onSlotsChanged?: () => void;
};

export function EventManageVolunteersCard({
  eventId,
  eventName,
  volunteers,
  isLoading,
  alreadyInvitedMemberIds = [],
  focusAddRoleToken = 0,
  onViewSignups,
  onSlotsChanged,
}: EventManageVolunteersCardProps) {
  const [slots, setSlots] = useState<VolunteerSlotResponse[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [roleName, setRoleName] = useState("");
  const [roleCapacity, setRoleCapacity] = useState("2");
  const [addingRole, setAddingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [showAddRole, setShowAddRole] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const pendingCount = volunteers.filter((row) => row.status === "pending").length;

  async function loadSlots() {
    setSlotsLoading(true);
    try {
      const response = await fetchEventVolunteerSlots(eventId);
      setSlots(response.slots);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  useEffect(() => {
    void loadSlots();
  }, [eventId]);

  useEffect(() => {
    if (focusAddRoleToken > 0) {
      setShowAddRole(true);
    }
  }, [focusAddRoleToken]);

  async function handleAddRole() {
    const name = roleName.trim();
    const max = Number(roleCapacity);
    if (!name) {
      setRoleError("Role name is required.");
      return;
    }
    if (!Number.isInteger(max) || max < 1) {
      setRoleError("Spots must be a whole number of at least 1.");
      return;
    }

    setAddingRole(true);
    setRoleError(null);
    try {
      const created = await createEventVolunteerSlot(eventId, {
        task_name: name,
        max_signup_count: max,
      });
      setSlots((current) => [...current, created]);
      setRoleName("");
      setRoleCapacity("2");
      setShowAddRole(false);
      onSlotsChanged?.();
    } catch (caught) {
      setRoleError(getApiErrorMessage(caught));
    } finally {
      setAddingRole(false);
    }
  }

  function startEdit(slot: VolunteerSlotResponse) {
    setEditingSlotId(slot.id);
    setEditName(slot.task_name);
    setEditCapacity(String(slot.max_signup_count));
    setRoleError(null);
  }

  async function handleSaveEdit(slotId: number) {
    const name = editName.trim();
    const max = Number(editCapacity);
    if (!name) {
      setRoleError("Role name is required.");
      return;
    }
    if (!Number.isInteger(max) || max < 1) {
      setRoleError("Spots must be a whole number of at least 1.");
      return;
    }

    setSavingEdit(true);
    setRoleError(null);
    try {
      const updated = await patchVolunteerSlot(slotId, {
        task_name: name,
        max_signup_count: max,
      });
      setSlots((current) =>
        current.map((slot) => (slot.id === slotId ? updated : slot)),
      );
      setEditingSlotId(null);
      onSlotsChanged?.();
    } catch (caught) {
      setRoleError(getApiErrorMessage(caught));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(slotId: number) {
    if (
      !window.confirm(
        "Delete this volunteer role? Current signups for the role will be removed.",
      )
    ) {
      return;
    }
    setDeletingId(slotId);
    setRoleError(null);
    try {
      await deleteVolunteerSlot(slotId);
      setSlots((current) => current.filter((slot) => slot.id !== slotId));
      if (editingSlotId === slotId) {
        setEditingSlotId(null);
      }
      onSlotsChanged?.();
    } catch (caught) {
      setRoleError(getApiErrorMessage(caught));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section aria-label="Volunteers">
      <div className="event-command-section-head">
        <h2 className="event-command-kicker">Volunteers</h2>
        <div className="flex items-center gap-3">
          {slots.length > 0 ? (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className={EVENT_MANAGE_ACTION_LINK}
            >
              Invite
            </button>
          ) : null}
          <button
            type="button"
            onClick={onViewSignups}
            className={EVENT_MANAGE_ACTION_LINK}
          >
            View interests
          </button>
        </div>
      </div>

      {slotsLoading ? (
        <p className="event-command-stat">Loading roles…</p>
      ) : slots.length === 0 ? (
        showAddRole ? null : (
          <p className="event-command-stat">
            Add roles with how many people you need, then invite helpers.
          </p>
        )
      ) : (
        <ul className="event-attention-list">
          {slots.map((slot) => (
            <li key={slot.id} className="event-attention-item">
              {editingSlotId === slot.id ? (
                <div className="w-full space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(changeEvent) => setEditName(changeEvent.target.value)}
                    className={inputFieldClassName}
                    aria-label="Role name"
                  />
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={editCapacity}
                    onChange={(changeEvent) =>
                      setEditCapacity(changeEvent.target.value)
                    }
                    className={inputFieldClassName}
                    aria-label="Spots"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit(slot.id)}
                      disabled={savingEdit}
                      className={EVENT_MANAGE_ACTION_LINK}
                    >
                      {savingEdit ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSlotId(null)}
                      className={EVENT_MANAGE_ACTION_LINK}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="event-attention-label">
                    {slot.task_name}
                    <span className="text-[#737373]">
                      {" "}
                      · {slot.signup_count}/{slot.max_signup_count}
                    </span>
                    {slot.filled_by && slot.filled_by.length > 0 ? (
                      <span className="mt-0.5 block text-xs font-normal text-[#737373]">
                        {slot.filled_by
                          .map((person) => person.full_name)
                          .join(", ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(slot)}
                      className={EVENT_MANAGE_ACTION_LINK}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(slot.id)}
                      disabled={deletingId === slot.id}
                      className="text-xs font-medium text-red-700 hover:text-red-800"
                    >
                      {deletingId === slot.id ? "Deleting…" : "Delete"}
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {roleError ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {roleError}
        </p>
      ) : null}

      {showAddRole ? (
        <div className="mt-3 space-y-2">
          <div>
            <label
              htmlFor={`volunteer-role-name-${eventId}`}
              className="block text-xs font-medium text-gray-500"
            >
              Role name
            </label>
            <input
              id={`volunteer-role-name-${eventId}`}
              type="text"
              value={roleName}
              onChange={(changeEvent) => {
                setRoleName(changeEvent.target.value);
                setRoleError(null);
              }}
              placeholder="e.g. Setup crew"
              className={`${inputFieldClassName} mt-1`}
            />
          </div>
          <div>
            <label
              htmlFor={`volunteer-role-spots-${eventId}`}
              className="block text-xs font-medium text-gray-500"
            >
              Spots
            </label>
            <input
              id={`volunteer-role-spots-${eventId}`}
              type="number"
              min={1}
              step={1}
              value={roleCapacity}
              onChange={(changeEvent) => {
                setRoleCapacity(changeEvent.target.value);
                setRoleError(null);
              }}
              className={`${inputFieldClassName} mt-1`}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleAddRole()}
              disabled={addingRole}
              className={EVENT_MANAGE_ACTION_LINK}
            >
              {addingRole ? "Adding…" : "Add role"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddRole(false);
                setRoleError(null);
              }}
              className={EVENT_MANAGE_ACTION_LINK}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setShowAddRole(true)}
            className={EVENT_MANAGE_ACTION_LINK}
          >
            Add role
          </button>
        </div>
      )}

      <dl className="event-command-facts mt-3">
        <div>
          <dt>General interest</dt>
          <dd>
            {isLoading
              ? "—"
              : pendingCount > 0
                ? `${volunteers.length} · ${pendingCount} pending`
                : volunteers.length}
          </dd>
        </div>
      </dl>

      <InviteMembersToEventModal
        open={inviteOpen}
        eventId={eventId}
        eventName={eventName}
        purpose="volunteers"
        alreadyInvitedMemberIds={alreadyInvitedMemberIds}
        onClose={() => setInviteOpen(false)}
      />
    </section>
  );
}
