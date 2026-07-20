import { describe, expect, it } from "vitest";

import {
  discussionRoomIdFromPath,
  discussionRoomPath,
  discussionScopeFromPath,
} from "./discussion-paths";

describe("discussion-paths", () => {
  it("maps board / event / room path scopes", () => {
    expect(discussionScopeFromPath("/discussions/board")).toEqual({
      type: "board",
    });
    expect(discussionScopeFromPath("/discussions/event/12")).toEqual({
      type: "event",
      eventId: 12,
    });
    expect(discussionScopeFromPath("/discussions/room/7")).toEqual({
      type: "room",
      roomId: 7,
    });
    expect(discussionScopeFromPath("/discussions")).toBeNull();
  });

  it("round-trips room ids to paths", () => {
    expect(discussionRoomPath("board")).toBe("/discussions/board");
    expect(discussionRoomPath("event:3")).toBe("/discussions/event/3");
    expect(discussionRoomPath("room:9")).toBe("/discussions/room/9");
    expect(discussionRoomIdFromPath("/discussions/room/9")).toBe("room:9");
  });
});
