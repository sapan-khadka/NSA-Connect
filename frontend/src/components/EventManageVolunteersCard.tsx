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
import {
  EVENT_MANAGE_ACTION_LINK,
  EVENT_MANAGE_CARD_CLASS,
  EVENT_MANAGE_EMPTY,
  EVENT_MANAGE_EYEBROW,
  EVENT_MANAGE_LOADING,
  EVENT_MANAGE_PRIMARY_BTN_FLEX,
  EVENT_MANAGE_SECONDARY_BTN_FLEX,
} from "../lib/event-manage-ui";
import { volunteerInitials } from "../lib/event-volunteer-summary";
import { HomeCard } from "./ui/HomeCard";
import { inputFieldClassName } from "./ui/Input";

type EventManageVolunteersCardProps = {
  eventId: number;
  volunteers: EventVolunteerSignupMember[];
  isLoading: boolean;
  onViewSignups: () => void;
  onConvertToTasks: () => void;
};

export function EventManageVolunteersCard({
  eventId,
  volunteers,
  isLoading,
  onViewSignups,
  onConvertToTasks,
}: EventManageVolunteersCardProps) {
  const [slots, setSlots] = useState<VolunteerSlotResponse[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [roleName, setRoleName] = useState("");
  const [roleCapacity, setRoleCapacity] = useState("4");
  const [addingRole, setAddingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [showAddRole, setShowAddRole] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const preview = volunteers.slice(0, 3);
  const pendingCount = volunteers.filter((row) => row.status === "pending").length;
  const countLabel =
    pendingCount > 0
      ? `${pendingCount} pending review`
      : volunteers.length === 1
        ? "1 interest"
        : `${volunteers.length} interests`;

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
      setRoleCapacity("4");
      setShowAddRole(false);
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
    } catch (caught) {
      setRoleError(getApiErrorMessage(caught));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <HomeCard
      padding="sm"
      className={EVENT_MANAGE_CARD_CLASS}
      aria-label="Volunteers"
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="home-section-title">Volunteers</h2>
        {!isLoading && volunteers.length > 0 ? (
          <button
            type="button"
            onClick={onViewSignups}
            className={EVENT_MANAGE_ACTION_LINK}
          >
            View interests
          </button>
        ) : null}
      </div>

      {slotsLoading ? (
        <p className={`mt-3 ${EVENT_MANAGE_LOADING}`}>Loading roles…</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <p className={EVENT_MANAGE_EYEBROW}>Roles</p>
            {slots.length === 0 ? (
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                Add roles like Setup, Food, or Cleanup so members can claim
                spots.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {slots.map((slot) => (
                  <li
                    key={slot.id}
                    className="rounded-xl border border-gray-100 bg-white px-2.5 py-2"
                  >
                    {editingSlotId === slot.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(changeEvent) =>
                            setEditName(changeEvent.target.value)
                          }
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
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit(slot.id)}
                            disabled={savingEdit}
                            className={EVENT_MANAGE_PRIMARY_BTN_FLEX}
                          >
                            {savingEdit ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSlotId(null)}
                            className={EVENT_MANAGE_SECONDARY_BTN_FLEX}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {slot.task_name}
                            </p>
                            {slot.description?.trim() ? (
                              <p className="mt-0.5 truncate text-xs text-gray-500">
                                {slot.description}
                              </p>
                            ) : null}
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              slot.is_full
                                ? "bg-amber-50 text-amber-800"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {slot.signup_count}/{slot.max_signup_count}
                          </span>
                        </div>
                        {slot.filled_by && slot.filled_by.length > 0 ? (
                          <p className="mt-1.5 text-xs text-gray-500">
                            {slot.filled_by
                              .map((person) => person.full_name)
                              .join(", ")}
                          </p>
                        ) : null}
                        <div className="mt-2 flex gap-2">
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
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {roleError ? (
            <p className="text-xs text-red-700" role="alert">
              {roleError}
            </p>
          ) : null}

          {showAddRole ? (
            <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleAddRole()}
                  disabled={addingRole}
                  className={EVENT_MANAGE_PRIMARY_BTN_FLEX}
                >
                  {addingRole ? "Adding…" : "Add role"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddRole(false);
                    setRoleError(null);
                  }}
                  className={EVENT_MANAGE_SECONDARY_BTN_FLEX}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddRole(true)}
              className={EVENT_MANAGE_SECONDARY_BTN_FLEX}
            >
              Add role
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <p className={`mt-4 ${EVENT_MANAGE_LOADING}`}>Loading interests…</p>
      ) : (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className={EVENT_MANAGE_EYEBROW}>General interest</p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">
                {volunteers.length}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{countLabel}</p>
            </div>
          </div>

          {volunteers.length === 0 ? (
            <div className={`mt-3 ${EVENT_MANAGE_EMPTY}`}>
              <p className="text-xs leading-relaxed text-gray-500">
                Members can also mark general interest from the event page.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {preview.map((signup) => (
                <li
                  key={signup.id}
                  className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-2.5 py-2"
                >
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-badge-teal-bg text-[10px] font-semibold text-primary"
                    aria-hidden="true"
                  >
                    {volunteerInitials(signup.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {signup.full_name}
                      {signup.status === "pending" ? (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Pending
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {signup.note?.trim() || "No note"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto flex gap-2 pt-3">
            <button
              type="button"
              onClick={onViewSignups}
              className={EVENT_MANAGE_PRIMARY_BTN_FLEX}
            >
              View interests
            </button>
            <button
              type="button"
              onClick={onConvertToTasks}
              className={EVENT_MANAGE_SECONDARY_BTN_FLEX}
            >
              Manage tasks
            </button>
          </div>
        </div>
      )}
    </HomeCard>
  );
}
