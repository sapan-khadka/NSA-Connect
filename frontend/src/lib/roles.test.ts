import { describe, expect, it } from "vitest";

import {
  canAccessFinance,
  canAccessMemberDocuments,
  canManageTreasury,
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

  it("allows member documents for self or board+, not other members", () => {
    expect(canAccessMemberDocuments("general", 2, 2)).toBe(true);
    expect(canAccessMemberDocuments("general", 2, 9)).toBe(false);
    expect(canAccessMemberDocuments("board", 1, 9)).toBe(true);
    expect(canAccessMemberDocuments("president", 1, 9)).toBe(true);
  });

  it("grants board-level nav and routes to board, treasurer, and president", () => {
    for (const role of ["board", "treasurer", "president"] as const) {
      expect(canAccessFinance(role)).toBe(true);
      expect(canViewMemberDirectory(role)).toBe(true);
      expect(getDashboardPath(role)).toBe("/");
    }
  });

  it("grants treasury write access to treasurer, president, and vice president", () => {
    expect(canManageTreasury("treasurer")).toBe(true);
    expect(canManageTreasury("president")).toBe(true);
    expect(canManageTreasury("board", "vice_president")).toBe(true);
    expect(canManageTreasury("board")).toBe(false);
    expect(canManageTreasury("board", "secretary")).toBe(false);
    expect(canManageTreasury("general")).toBe(false);
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
