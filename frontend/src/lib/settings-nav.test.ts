import { describe, expect, it } from "vitest";

import {
  canAccessEmailIntegration,
  getSettingsNavGroups,
  getSettingsNavItems,
} from "./settings-nav";

describe("settings-nav", () => {
  it("keeps chapter email off the member settings nav", () => {
    expect(canAccessEmailIntegration("general")).toBe(false);
    expect(getSettingsNavItems("general").map((item) => item.id)).toEqual([
      "profile",
      "privacy",
      "notifications",
      "security",
    ]);
    expect(getSettingsNavGroups("general").map((group) => group.id)).toEqual([
      "account",
    ]);
  });

  it("adds chapter email for board members", () => {
    expect(canAccessEmailIntegration("board")).toBe(true);
    expect(getSettingsNavItems("board").map((item) => item.id)).toEqual([
      "profile",
      "privacy",
      "notifications",
      "security",
      "email",
    ]);
    expect(
      getSettingsNavGroups("board").map((group) => ({
        id: group.id,
        items: group.items.map((item) => item.id),
      })),
    ).toEqual([
      {
        id: "account",
        items: ["profile", "privacy", "notifications", "security"],
      },
      { id: "chapter", items: ["email"] },
    ]);
  });
});
