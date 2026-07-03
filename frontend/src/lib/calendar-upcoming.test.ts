import { describe, expect, it } from "vitest";

import { createMockEventResponse } from "../test/test-utils";
import { groupUpcomingEvents } from "./calendar-upcoming";

describe("calendar-upcoming", () => {
  it("groups upcoming events by urgency", () => {
    const now = new Date("2030-06-10T12:00:00");

    const groups = groupUpcomingEvents(
      [
        createMockEventResponse({
          id: 1,
          name: "This week",
          starts_at: "2030-06-12T18:00:00+00:00",
        }),
        createMockEventResponse({
          id: 2,
          name: "Later this month",
          starts_at: "2030-06-25T18:00:00+00:00",
        }),
        createMockEventResponse({
          id: 3,
          name: "Next quarter",
          starts_at: "2030-08-01T18:00:00+00:00",
        }),
      ],
      now,
    );

    expect(groups.this_week.map((event) => event.name)).toEqual(["This week"]);
    expect(groups.this_month.map((event) => event.name)).toEqual([
      "Later this month",
    ]);
    expect(groups.next_3_months.map((event) => event.name)).toEqual([
      "Next quarter",
    ]);
  });
});
