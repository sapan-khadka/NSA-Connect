import { describe, expect, it } from "vitest";

import {
  filledNeededRoles,
  inferVolunteerRole,
  volunteerInitials,
} from "./event-volunteer-summary";

describe("event-volunteer-summary", () => {
  it("infers roles from signup notes", () => {
    expect(inferVolunteerRole("I can help with setup")).toBe("Setup");
    expect(inferVolunteerRole("registration desk")).toBe("Registration");
    expect(inferVolunteerRole("happy to take photos")).toBe("Photography");
    expect(inferVolunteerRole("cleanup crew")).toBe("Cleanup");
    expect(inferVolunteerRole(null)).toBe("General help");
  });

  it("marks needed roles as filled from signups", () => {
    const filled = filledNeededRoles([
      {
        id: 1,
        member_id: 1,
        full_name: "A",
        note: "setup help",
        created_at: "2030-01-01T00:00:00Z",
      },
      {
        id: 2,
        member_id: 2,
        full_name: "B",
        note: null,
        created_at: "2030-01-01T00:00:00Z",
      },
    ]);

    expect(filled.has("Setup")).toBe(true);
    expect(filled.has("Cleanup")).toBe(false);
  });

  it("builds initials", () => {
    expect(volunteerInitials("Mukesh Thapa")).toBe("MT");
  });
});
