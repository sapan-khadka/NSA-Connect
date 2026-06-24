import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";

import { RolePromotionSelect } from "./RolePromotionSelect";

const generalMember: MemberResponse = {
  id: 2,
  full_name: "General Member",
  email: "general@semo.edu",
  student_id: "12345678",
  major: "Biology",
  graduation_year: 2028,
  role: "general",
  status: "approved",
};

describe("RolePromotionSelect", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a dropdown for general and board members", () => {
    render(
      <RolePromotionSelect
        member={generalMember}
        onRoleChange={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText("Change role for General Member"),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Board" })).toBeInTheDocument();
  });

  it("calls onRoleChange when a new role is selected", async () => {
    const user = userEvent.setup();
    const onRoleChange = vi.fn();

    render(
      <RolePromotionSelect
        member={generalMember}
        onRoleChange={onRoleChange}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Change role for General Member"),
      "board",
    );

    expect(onRoleChange).toHaveBeenCalledWith(2, "board");
  });

  it("shows a read-only badge for non-promotable roles", () => {
    render(
      <RolePromotionSelect
        member={{ ...generalMember, role: "treasurer" }}
        onRoleChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Treasurer")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Change role for General Member"),
    ).not.toBeInTheDocument();
  });
});
