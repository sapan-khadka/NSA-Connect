import { beforeEach, describe, expect, it } from "vitest";

import {
  markNotificationRead,
  markNotificationsRead,
  readNotificationReadIds,
} from "./notification-read-state";

describe("notification-read-state", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty and persists marked ids", () => {
    expect(readNotificationReadIds().size).toBe(0);

    const afterOne = markNotificationRead("a");
    expect(afterOne.has("a")).toBe(true);
    expect(readNotificationReadIds().has("a")).toBe(true);

    const afterMany = markNotificationsRead(["b", "c"]);
    expect([...afterMany].sort()).toEqual(["a", "b", "c"]);
  });
});
