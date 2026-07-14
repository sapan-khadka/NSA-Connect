import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_INVITE_FORM,
  INVITE_DRAFT_STORAGE_KEY,
  validateInviteForm,
} from "../lib/invite-member-form";
import { InviteMemberDrawer } from "./InviteMemberDrawer";

describe("validateInviteForm", () => {
  it("requires personal, organization, role, graduation, and email", () => {
    const errors = validateInviteForm(EMPTY_INVITE_FORM);
    expect(errors.firstName).toBeTruthy();
    expect(errors.lastName).toBeTruthy();
    expect(errors.organization).toBeTruthy();
    expect(errors.role).toBeTruthy();
    expect(errors.graduationYear).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.committee).toBeUndefined();
    expect(errors.phone).toBeUndefined();
  });

  it("rejects invalid email and short phone", () => {
    const errors = validateInviteForm({
      ...EMPTY_INVITE_FORM,
      firstName: "Alex",
      lastName: "Member",
      organization: "nsa-main",
      role: "general",
      graduationYear: "2027",
      email: "not-an-email",
      phone: "123",
    });
    expect(errors.email).toMatch(/valid email/i);
    expect(errors.phone).toMatch(/10/);
  });
});

describe("InviteMemberDrawer", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders the professional drawer sections and actions", () => {
    render(<InviteMemberDrawer open onClose={() => undefined} />);

    const dialog = screen.getByRole("dialog", { name: "Invite Member" });
    expect(
      within(dialog).getByRole("heading", { name: "Personal" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Organization" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Role" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Committee" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Graduation" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Contact" }),
    ).toBeInTheDocument();

    expect(
      within(dialog).getByRole("button", { name: "Invite" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Save Draft" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
  });

  it("shows validation feedback when inviting with an empty form", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<InviteMemberDrawer open onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Invite" }));

    expect(
      screen.getByText(/fields need attention before you can send the invite/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/First name is required/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("saves a local draft and restores it on reopen", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <InviteMemberDrawer open onClose={() => undefined} />,
    );

    await user.type(screen.getByLabelText(/First name/i), "Alex");
    await user.click(screen.getByRole("button", { name: "Save Draft" }));

    expect(screen.getByRole("status")).toHaveTextContent(/Draft saved/i);
    expect(
      JSON.parse(window.localStorage.getItem(INVITE_DRAFT_STORAGE_KEY) ?? "{}")
        .firstName,
    ).toBe("Alex");

    rerender(<InviteMemberDrawer open={false} onClose={() => undefined} />);
    rerender(<InviteMemberDrawer open onClose={() => undefined} />);

    expect(screen.getByLabelText(/First name/i)).toHaveValue("Alex");
  });

  it("closes on Cancel without clearing an existing draft", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    window.localStorage.setItem(
      INVITE_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...EMPTY_INVITE_FORM, firstName: "Keep" }),
    );

    render(<InviteMemberDrawer open onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem(INVITE_DRAFT_STORAGE_KEY)).toBeTruthy();
  });
});
