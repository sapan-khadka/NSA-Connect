import type { VolunteerSlotResponse } from "../lib/events-api";

export type VolunteerSlotTotals = {
  filled: number;
  needed: number;
  /** True when the board has configured at least one volunteer role. */
  hasTarget: boolean;
};

/** Aggregate filled/needed from board-configured volunteer role spots. */
export function summarizeVolunteerSlots(
  slots: VolunteerSlotResponse[],
): VolunteerSlotTotals {
  if (slots.length === 0) {
    return { filled: 0, needed: 0, hasTarget: false };
  }
  let filled = 0;
  let needed = 0;
  for (const slot of slots) {
    filled += Math.max(0, slot.signup_count);
    needed += Math.max(0, slot.max_signup_count);
  }
  return { filled, needed, hasTarget: needed > 0 };
}

export function volunteerInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}
