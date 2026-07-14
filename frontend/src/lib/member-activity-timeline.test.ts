import { describe, expect, it } from "vitest";

import {
  groupMemberActivityByDay,
  MEMBER_ACTIVITY_TITLES,
  sortMemberActivityItems,
  type MemberActivityItem,
} from "./member-activity-timeline";

function item(
  partial: Partial<MemberActivityItem> &
    Pick<MemberActivityItem, "id" | "kind" | "occurredAt">,
): MemberActivityItem {
  return {
    title: MEMBER_ACTIVITY_TITLES[partial.kind],
    ...partial,
  };
}

describe("sortMemberActivityItems", () => {
  it("orders newest first", () => {
    const sorted = sortMemberActivityItems([
      item({
        id: "1",
        kind: "joined",
        occurredAt: "2030-06-10T12:00:00",
      }),
      item({
        id: "2",
        kind: "paid_dues",
        occurredAt: "2030-06-15T12:00:00",
      }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["2", "1"]);
  });
});

describe("groupMemberActivityByDay", () => {
  const now = new Date("2030-06-15T15:00:00");

  it("groups by day with Today / Yesterday labels", () => {
    const groups = groupMemberActivityByDay(
      [
        item({
          id: "a",
          kind: "attended_event",
          occurredAt: "2030-06-15T10:00:00",
          detail: "Dashain Night",
        }),
        item({
          id: "b",
          kind: "completed_task",
          occurredAt: "2030-06-15T09:00:00",
          detail: "Order decorations",
        }),
        item({
          id: "c",
          kind: "paid_dues",
          occurredAt: "2030-06-14T16:00:00",
        }),
        item({
          id: "d",
          kind: "joined",
          occurredAt: "2030-06-01T12:00:00",
        }),
      ],
      now,
    );

    expect(groups).toHaveLength(3);
    expect(groups[0]?.label).toBe("Today");
    expect(groups[0]?.items.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(groups[1]?.label).toBe("Yesterday");
    expect(groups[2]?.items[0]?.kind).toBe("joined");
  });

  it("returns an empty list when there is no activity", () => {
    expect(groupMemberActivityByDay([], now)).toEqual([]);
  });
});
