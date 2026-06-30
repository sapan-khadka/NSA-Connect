import { describe, expect, it } from "vitest";

import {
  canAccessFinance,
  canPresidentPromoteMember,
  canViewMemberDirectory,
  getDashboardPath,
  getMemberDisplayRole,
  isRoleAtLeast,
} from "./roles";

describe("role access helpers", () => {
  it("treats general members as below board-level access", () => {
    expect(isRoleAtLeast("general", "board")).toBe(false);
    expect(canAccessFinance("general")).toBe(false);
    expect(canViewMemberDirectory("general")).toBe(false);
    expect(getDashboardPath("general")).toBe("/");
  });

  it("grants board-level nav and routes to board, treasurer, and president", () => {
    for (const role of ["board", "treasurer", "president"] as const) {
      expect(canAccessFinance(role)).toBe(true);
      expect(canViewMemberDirectory(role)).toBe(true);
      expect(getDashboardPath(role)).toBe("/");
    }
  });

  it("derives display role from assigned position", () => {
    expect(
      getMemberDisplayRole({ role: "board", position: "president" }),
    ).toBe("president");
    expect(
      getMemberDisplayRole({ role: "president", position: "member" }),
    ).toBe("board");
  });

  it("blocks role promotion when a leadership position is assigned", () => {
    expect(
      canPresidentPromoteMember(
        {
          id: 2,
          role: "board",
          status: "approved",
          position: "vice_president",
        },
        1,
      ),
    ).toBe(false);
  });
});
