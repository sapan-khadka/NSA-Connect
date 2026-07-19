import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import { MockAuthProvider } from "../test/test-utils";
import { EditMemberDrawer } from "./EditMemberDrawer";

vi.mock("../lib/members-api", () => ({
  updateMemberProfile: vi.fn(),
  updateMemberRole: vi.fn(),
  updateMemberPosition: vi.fn(),
  fetchMemberPositionCatalog: vi.fn().mockResolvedValue({
    built_in: [
      { key: "president", label: "President", immutable: true },
      { key: "member", label: "Member", immutable: true },
    ],
    custom: [],
  }),
}));

const subject: MemberResponse = {
  id: 3,
  full_name: "Alex Member",
  email: "alex@semo.edu",
  student_id: "S1",
  major: "Biology",
  graduation_year: 2028,
  role: "general",
  status: "approved",
  position: "member",
  talents: [],
};

function renderEdit(
  viewer: MemberResponse,
  props: Partial<ComponentProps<typeof EditMemberDrawer>> = {},
) {
  return render(
    <MockAuthProvider
      value={{
        member: viewer,
        isAuthenticated: true,
      }}
    >
      <EditMemberDrawer
        member={subject}
        open
        onClose={vi.fn()}
        onMemberUpdated={vi.fn()}
        {...props}
      />
    </MockAuthProvider>,
  );
}

describe("EditMemberDrawer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows profile fields but not role/position for board (non-president)", () => {
    renderEdit({
      id: 1,
      full_name: "Board Viewer",
      email: "board@semo.edu",
      student_id: "11111111",
      major: "CS",
      graduation_year: 2027,
      role: "board",
      status: "approved",
      position: "member",
    });

    const dialog = screen.getByRole("dialog", { name: /Edit Member/i });
    expect(within(dialog).getByLabelText("Full name")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Email")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Major")).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText("Graduation year"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Talents")).toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText("Role and position"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText(/Change role/),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText(/Change position/),
    ).not.toBeInTheDocument();
  });

  it("shows role and position controls for president", () => {
    renderEdit({
      id: 1,
      full_name: "President Viewer",
      email: "president@semo.edu",
      student_id: "22222222",
      major: "CS",
      graduation_year: 2027,
      role: "president",
      status: "approved",
      position: "president",
    });

    const dialog = screen.getByRole("dialog", { name: /Edit Member/i });
    expect(
      within(dialog).getByLabelText("Role and position"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(/Change role for Alex Member/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(/Change position for Alex Member/),
    ).toBeInTheDocument();
  });

  it("saves profile fields via updateMemberProfile", async () => {
    const user = userEvent.setup();
    const { updateMemberProfile } = await import("../lib/members-api");
    const onMemberUpdated = vi.fn();
    const onClose = vi.fn();
    vi.mocked(updateMemberProfile).mockResolvedValue({
      ...subject,
      full_name: "Alex Updated",
      major: "Chemistry",
    });

    renderEdit(
      {
        id: 1,
        full_name: "Board Viewer",
        email: "board@semo.edu",
        student_id: "11111111",
        major: "CS",
        graduation_year: 2027,
        role: "board",
        status: "approved",
        position: "member",
      },
      { onMemberUpdated, onClose },
    );

    const dialog = screen.getByRole("dialog", { name: /Edit Member/i });
    await user.clear(within(dialog).getByLabelText("Full name"));
    await user.type(within(dialog).getByLabelText("Full name"), "Alex Updated");
    await user.clear(within(dialog).getByLabelText("Major"));
    await user.type(within(dialog).getByLabelText("Major"), "Chemistry");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    expect(updateMemberProfile).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        full_name: "Alex Updated",
        major: "Chemistry",
        email: "alex@semo.edu",
        graduation_year: 2028,
      }),
    );
    expect(onMemberUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: "Alex Updated" }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
