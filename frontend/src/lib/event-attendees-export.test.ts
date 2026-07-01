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

  it("labels members without a response in csv exports", () => {
    const csv = buildAttendeesCsv([
      {
        member_id: 2,
        full_name: "Pending Member",
        member_type: "General member",
        rsvp_status: null,
      },
    ]);

    expect(csv).toBe(
      "Name,Member type,RSVP status\nPending Member,General member,Not yet responded",
    );
  });
});
