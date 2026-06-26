import { describe, expect, it } from "vitest";

import {
  canAccessFinance,
  canViewMemberDirectory,
  getDashboardPath,
  isRoleAtLeast,
} from "./roles";

describe("role access helpers", () => {
  it("treats general members as below board-level access", () => {
    expect(isRoleAtLeast("general", "board")).toBe(false);
    expect(canAccessFinance("general")).toBe(false);
    expect(canViewMemberDirectory("general")).toBe(false);
    expect(getDashboardPath("general")).toBe("/member");
  });

  it("grants board-level nav and routes to board, treasurer, and president", () => {
    for (const role of ["board", "treasurer", "president"] as const) {
      expect(canAccessFinance(role)).toBe(true);
      expect(canViewMemberDirectory(role)).toBe(true);
      expect(getDashboardPath(role)).toBe("/board");
    }
  });
});
