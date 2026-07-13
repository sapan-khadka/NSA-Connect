import { describe, expect, it } from "vitest";

import {
  buildEventActivityTimeline,
  formatActivityDayLabel,
  formatActivityTimeLabel,
  groupEventActivityByDay,
} from "./event-activity-timeline";
import { createMockEventDetailResponse } from "../test/test-utils";

describe("event-activity-timeline", () => {
  const now = new Date("2030-06-15T15:00:00");

  it("formats relative day labels", () => {
    expect(formatActivityDayLabel("2030-06-15T12:00:00", now)).toBe("Today");
    expect(formatActivityDayLabel("2030-06-14T12:00:00", now)).toBe("Yesterday");
  });

  it("formats recent minute-based timestamps", () => {
    expect(
      formatActivityTimeLabel("2030-06-15T14:58:00", now),
    ).toBe("2 minutes ago");
  });

  it("groups items by day newest first", () => {
    const items = buildEventActivityTimeline({
      event: createMockEventDetailResponse({
        event_photo_url: "https://example.com/p.jpg",
      }),
      volunteerCount: 2,
      hasBudget: true,
      now,
    });
    const groups = groupEventActivityByDay(items, now);

    expect(groups[0]?.label).toBe("Today");
    expect(items.some((item) => item.title === "Budget updated")).toBe(true);
    expect(items.some((item) => item.title === "Volunteer assigned")).toBe(true);
    expect(items.some((item) => item.isPlaceholder)).toBe(true);
  });
});
