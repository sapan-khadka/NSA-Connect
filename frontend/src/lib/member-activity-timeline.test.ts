import { describe, expect, it } from "vitest";

import {
  groupMemberActivityByDay,
  mapMemberActivityApiItem,
  MEMBER_ACTIVITY_TITLES,
  sortMemberActivityItems,
  takeMemberActivityPreview,
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
        kind: "dues_paid",
        occurredAt: "2030-06-10T12:00:00",
      }),
      item({
        id: "2",
        kind: "task_completed",
        occurredAt: "2030-06-15T12:00:00",
      }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["2", "1"]);
  });
});

describe("mapMemberActivityApiItem", () => {
  it("maps API payloads into timeline items with event links", () => {
    expect(
      mapMemberActivityApiItem({
        id: "task_completed-9",
        type: "task_completed",
        description: "Completed 'Book venue' for Dashain",
        timestamp: "2030-06-15T12:00:00.000Z",
        task_id: 9,
        event_id: 10,
        dues_record_id: null,
      }),
    ).toMatchObject({
      kind: "task_completed",
      title: "Completed 'Book venue' for Dashain",
      href: "/events/10",
      taskId: 9,
    });
  });
});

describe("groupMemberActivityByDay", () => {
  const now = new Date("2030-06-15T15:00:00");

  it("groups by day with Today / Yesterday labels", () => {
    const groups = groupMemberActivityByDay(
      [
        item({
          id: "a",
          kind: "event_checkin",
          occurredAt: "2030-06-15T10:00:00",
          title: "Attended Dashain Night",
        }),
        item({
          id: "b",
          kind: "task_completed",
          occurredAt: "2030-06-15T09:00:00",
          title: "Completed 'Order decorations'",
        }),
        item({
          id: "c",
          kind: "dues_paid",
          occurredAt: "2030-06-14T16:00:00",
        }),
      ],
      now,
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.label).toBe("Today");
    expect(groups[0]?.items.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(groups[1]?.label).toBe("Yesterday");
  });

  it("returns an empty list when there is no activity", () => {
    expect(groupMemberActivityByDay([], now)).toEqual([]);
  });
});

describe("takeMemberActivityPreview", () => {
  it("caps preview length", () => {
    const items = Array.from({ length: 8 }, (_, index) =>
      item({
        id: String(index),
        kind: "dues_paid",
        occurredAt: `2030-06-${String(index + 1).padStart(2, "0")}T12:00:00`,
      }),
    );
    const preview = takeMemberActivityPreview(items, 6);
    expect(preview.preview).toHaveLength(6);
    expect(preview.hasMore).toBe(true);
  });
});
