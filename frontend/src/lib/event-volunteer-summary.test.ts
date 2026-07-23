import { describe, expect, it } from "vitest";

import {
  summarizeVolunteerSlots,
  volunteerInitials,
} from "./event-volunteer-summary";
import type { VolunteerSlotResponse } from "./events-api";

function slot(
  partial: Partial<VolunteerSlotResponse> & {
    id: number;
    max_signup_count: number;
    signup_count: number;
  },
): VolunteerSlotResponse {
  return {
    event_id: 1,
    task_name: "Setup",
    description: "",
    spots_remaining: Math.max(
      0,
      partial.max_signup_count - partial.signup_count,
    ),
    is_full: partial.signup_count >= partial.max_signup_count,
    created_at: "2030-01-01T00:00:00Z",
    ...partial,
  };
}

describe("event-volunteer-summary", () => {
  it("reports no target when roles are not configured", () => {
    expect(summarizeVolunteerSlots([])).toEqual({
      filled: 0,
      needed: 0,
      hasTarget: false,
    });
  });

  it("sums filled and needed spots from configured roles", () => {
    expect(
      summarizeVolunteerSlots([
        slot({ id: 1, max_signup_count: 2, signup_count: 1 }),
        slot({ id: 2, task_name: "Cleanup", max_signup_count: 3, signup_count: 0 }),
      ]),
    ).toEqual({
      filled: 1,
      needed: 5,
      hasTarget: true,
    });
  });

  it("builds initials", () => {
    expect(volunteerInitials("Mukesh Thapa")).toBe("MT");
  });
});
