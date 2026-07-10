import { describe, expect, it } from "vitest";

import { getMobileActivityPreview } from "./home-activity-preview";
import type { HomeActivity } from "./home-activities";

function activity(
  id: string,
  kind: HomeActivity["kind"],
  tone: HomeActivity["tone"] = "info",
): HomeActivity {
  return {
    id,
    message: id,
    to: "/",
    actionLabel: "View",
    tone,
    kind,
  };
}

describe("getMobileActivityPreview", () => {
  it("returns up to maxItems recent items when there are no actionable items", () => {
    const recent = [
      activity("r1", "recent"),
      activity("r2", "recent"),
      activity("r3", "recent"),
    ];

    expect(getMobileActivityPreview(recent, 2)).toHaveLength(2);
  });

  it("never truncates actionable items when there are more than maxItems", () => {
    const items = [
      activity("a1", "actionable", "urgent"),
      activity("a2", "actionable", "urgent"),
      activity("a3", "actionable", "urgent"),
    ];

    expect(getMobileActivityPreview(items, 2)).toHaveLength(3);
  });

  it("fills remaining slots with recent items after actionable ones", () => {
    const items = [
      activity("a1", "actionable", "urgent"),
      activity("r1", "recent"),
      activity("r2", "recent"),
    ];

    expect(getMobileActivityPreview(items, 2)).toEqual([
      items[0],
      items[1],
    ]);
  });
});
