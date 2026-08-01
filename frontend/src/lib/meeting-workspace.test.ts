import { describe, expect, it } from "vitest";

import {
  meetingTabFromHash,
  meetingWorkspacePath,
  parseMeetingWorkspaceTab,
} from "./meeting-workspace";

describe("meeting-workspace", () => {
  it("parses known tabs and defaults to overview", () => {
    expect(parseMeetingWorkspaceTab("minutes")).toBe("minutes");
    expect(parseMeetingWorkspaceTab("ai-summary")).toBe("ai-summary");
    expect(parseMeetingWorkspaceTab("nope")).toBe("overview");
    expect(parseMeetingWorkspaceTab(null)).toBe("overview");
  });

  it("maps legacy hashes to tabs", () => {
    expect(meetingTabFromHash("#meeting-minutes")).toBe("minutes");
    expect(meetingTabFromHash("#ai-summary")).toBe("ai-summary");
    expect(meetingTabFromHash("#other")).toBeNull();
  });

  it("builds workspace paths", () => {
    expect(meetingWorkspacePath(5)).toBe("/events/meetings/5");
    expect(meetingWorkspacePath(5, "overview")).toBe("/events/meetings/5");
    expect(meetingWorkspacePath(5, "minutes")).toBe(
      "/events/meetings/5?tab=minutes",
    );
  });
});
