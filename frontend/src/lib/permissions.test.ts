import { describe, expect, it } from "vitest";

import { membershipHas, permissionsForMembership } from "./permissions";

describe("permissions catalog", () => {
  it("grants board manage_finance view but not manage_members", () => {
    expect(
      membershipHas({ role: "board", position: "member" }, "manage_finance"),
    ).toBe(true);
    expect(
      membershipHas({ role: "board", position: "member" }, "manage_members"),
    ).toBe(false);
    expect(
      membershipHas({ role: "board", position: "member" }, "manage_tasks"),
    ).toBe(false);
  });

  it("grants vice president the same member and treasury writes as president", () => {
    expect(
      membershipHas(
        { role: "board", position: "vice_president" },
        "manage_members",
      ),
    ).toBe(true);
    expect(
      membershipHas(
        { role: "board", position: "vice_president" },
        "manage_finance_write",
      ),
    ).toBe(true);
    expect(
      membershipHas(
        { role: "board", position: "vice_president" },
        "assign_roles",
      ),
    ).toBe(true);
  });

  it("does not grant task ops to owner-only memberships", () => {
    expect(
      membershipHas(
        { role: "general", position: "member", isOrgOwner: true },
        "manage_members",
      ),
    ).toBe(true);
    expect(
      membershipHas(
        { role: "general", position: "member", isOrgOwner: true },
        "manage_tasks",
      ),
    ).toBe(false);
  });

  it("unions owner and president permissions", () => {
    const perms = permissionsForMembership({
      role: "president",
      position: "president",
      isOrgOwner: true,
    });
    expect(perms.has("manage_tasks")).toBe(true);
    expect(perms.has("transfer_ownership")).toBe(true);
  });
});
