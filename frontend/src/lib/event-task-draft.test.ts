import { describe, expect, it } from "vitest";

import { buildVolunteerTaskDraft } from "./event-task-draft";

describe("buildVolunteerTaskDraft", () => {
  it("prefills title, assignee, and note from a volunteer signup", () => {
    expect(
      buildVolunteerTaskDraft("tihar", {
        member_id: 6,
        full_name: "apsana",
        note: "i can help with the decoration.",
      }),
    ).toEqual({
      title: "Help with tihar",
      description: "i can help with the decoration.",
      assigneeId: 6,
      assigneeName: "apsana",
    });
  });

  it("uses empty description when the volunteer left no note", () => {
    expect(
      buildVolunteerTaskDraft("Spring Social", {
        member_id: 2,
        full_name: "Alex",
        note: null,
      }).description,
    ).toBe("");
  });
});
