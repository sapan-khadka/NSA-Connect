import { describe, expect, it } from "vitest";

import { buildAttendeesCsv } from "../lib/event-attendees-export";

describe("event-attendees-export", () => {
  it("builds csv with attendee columns", () => {
    const csv = buildAttendeesCsv([
      {
        member_id: 1,
        full_name: "Alpha Board",
        member_type: "Board member",
        rsvp_status: "going",
      },
    ]);

    expect(csv).toBe("Name,Member type,RSVP status\nAlpha Board,Board member,Going");
  });
});
