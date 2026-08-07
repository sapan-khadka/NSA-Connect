import { describe, expect, it } from "vitest";

import { membershipHas, permissionsForMembership } from "./permissions";

describe("permissions catalog", () => {
  it("grants board manage_members but not manage_tasks", () => {
    expect(
      membershipHas({ role: "board", position: "member" }, "manage_members"),
    ).toBe(true);
    expect(
      membershipHas({ role: "board", position: "member" }, "manage_tasks"),
    ).toBe(false);
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
