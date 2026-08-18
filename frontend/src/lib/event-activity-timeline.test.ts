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

  it("groups real signal items by day newest first", () => {
    const items = buildEventActivityTimeline({
      event: createMockEventDetailResponse({
        event_photo_url: "https://example.com/p.jpg",
        starts_at: "2030-06-15T18:00:00",
      }),
      volunteerCount: 2,
      hasBudget: true,
      now,
    });
    const groups = groupEventActivityByDay(items, now);

    expect(groups[0]?.label).toBe("Today");
    expect(items.some((item) => item.title === "Budget assigned")).toBe(true);
    expect(items.some((item) => item.title === "Volunteers signed up")).toBe(
      true,
    );
    expect(items.some((item) => item.isPlaceholder)).toBe(false);
    expect(items.some((item) => item.title === "Reminder email sent")).toBe(
      false,
    );
  });

  it("omits invented rows when signals are missing", () => {
    const items = buildEventActivityTimeline({
      event: createMockEventDetailResponse({
        event_photo_url: null,
        starts_at: "2030-06-20T18:00:00",
      }),
      volunteerCount: 0,
      hasBudget: false,
      now,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("schedule");
  });
});
