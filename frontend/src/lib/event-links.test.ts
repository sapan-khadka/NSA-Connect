import { describe, expect, it } from "vitest";

import { calendarDeepLink, eventDetailPath } from "./event-links";

describe("event-links", () => {
  it("builds event detail paths", () => {
    expect(eventDetailPath(42)).toBe("/events/42");
  });

  it("builds calendar deep links with date and event id", () => {
    expect(
      calendarDeepLink({
        id: 5,
        starts_at: "2030-06-15T18:00:00+00:00",
      }),
    ).toBe("/events/calendar?date=2030-06-15&event=5");
  });
});
