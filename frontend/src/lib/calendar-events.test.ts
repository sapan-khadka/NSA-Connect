import { describe, expect, it } from "vitest";

import { groupEventCountsByMonth, groupEventsByDate, groupEventTypesByDate } from "./calendar-events";

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

describe("groupEventsByDate", () => {
  it("keeps named events on the same local day", () => {
    const grouped = groupEventsByDate([
      {
        id: 1,
        name: "Cultural Night",
        starts_at: "2030-06-15T14:00:00+00:00",
        event_type: "cultural",
      },
      {
        id: 2,
        name: "Board Meeting",
        starts_at: "2030-06-15T18:00:00+00:00",
        event_type: "meeting",
      },
    ]);

    expect(grouped.get("2030-06-15")?.map((event) => event.name)).toEqual([
      "Cultural Night",
      "Board Meeting",
    ]);
  });
});

describe("groupEventCountsByMonth", () => {
  it("counts events in the requested year", () => {
    const counts = groupEventCountsByMonth(
      [
        {
          starts_at: "2030-08-10T18:00:00+00:00",
          event_type: "social",
        },
        {
          starts_at: "2030-08-22T18:00:00+00:00",
          event_type: "cultural",
        },
        {
          starts_at: "2029-08-10T18:00:00+00:00",
          event_type: "meeting",
        },
      ],
      2030,
    );

    expect(counts.get(7)).toBe(2);
    expect(counts.get(6)).toBeUndefined();
  });
});
