import { describe, expect, it } from "vitest";

import { groupEventTypesByDate } from "./calendar-events";

describe("groupEventTypesByDate", () => {
  it("groups unique types on the same local day", () => {
    const grouped = groupEventTypesByDate([
      {
        starts_at: "2030-06-15T14:00:00+00:00",
        event_type: "cultural",
      },
      {
        starts_at: "2030-06-15T20:00:00+00:00",
        event_type: "cultural",
      },
      {
        starts_at: "2030-06-15T18:00:00+00:00",
        event_type: "meeting",
      },
    ]);

    expect(grouped.get("2030-06-15")).toEqual(["cultural", "meeting"]);
  });
});
