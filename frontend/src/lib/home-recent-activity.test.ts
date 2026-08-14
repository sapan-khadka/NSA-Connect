import { describe, expect, it } from "vitest";

import {
  HOME_ACTIVITY_LIMIT,
  isWithinActivityWindow,
  selectHomeRecentActivity,
} from "./home-recent-activity";
import type { MemberActivityItem } from "./member-activity-timeline";

function item(
  overrides: Partial<MemberActivityItem> & Pick<MemberActivityItem, "id" | "occurredAt">,
): MemberActivityItem {
  return {
    kind: "task_completed",
    title: "Completed something",
    ...overrides,
  };
}

describe("selectHomeRecentActivity", () => {
  const now = new Date("2026-08-01T16:00:00");

  it("keeps only items inside the recency window, newest first", () => {
    const selected = selectHomeRecentActivity(
      [
        item({ id: "old", occurredAt: "2026-06-01T10:00:00", title: "Old" }),
        item({ id: "mid", occurredAt: "2026-07-20T10:00:00", title: "Mid" }),
        item({ id: "new", occurredAt: "2026-07-30T10:00:00", title: "New" }),
      ],
      { now, limit: HOME_ACTIVITY_LIMIT, windowDays: 30 },
    );

    expect(selected.map((row) => row.id)).toEqual(["new", "mid"]);
  });

  it("caps at the Home limit when more than N fall in the window", () => {
    const selected = selectHomeRecentActivity(
      Array.from({ length: 8 }, (_, index) =>
        item({
          id: `t-${index}`,
          occurredAt: `2026-07-${String(20 + index).padStart(2, "0")}T10:00:00`,
        }),
      ),
      { now, limit: 3, windowDays: 30 },
    );
    expect(selected).toHaveLength(3);
    expect(selected[0]?.id).toBe("t-7");
  });

  it("returns empty when nothing is recent enough", () => {
    expect(
      selectHomeRecentActivity(
        [item({ id: "x", occurredAt: "2025-01-01T00:00:00" })],
        { now },
      ),
    ).toEqual([]);
  });
});

describe("isWithinActivityWindow", () => {
  const now = new Date("2026-08-01T12:00:00");

  it("accepts timestamps within the window", () => {
    expect(isWithinActivityWindow("2026-07-15T12:00:00", now, 30)).toBe(true);
  });

  it("rejects timestamps older than the window", () => {
    expect(isWithinActivityWindow("2026-06-01T12:00:00", now, 30)).toBe(false);
  });
});
