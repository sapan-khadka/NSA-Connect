import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADD_MEMBER_DRAFT_STORAGE_KEY,
  EMPTY_ADD_MEMBER_FORM,
  validateAddMemberForm,
} from "../lib/add-member-form";
import { addMember } from "../lib/members-api";
import { AddMemberDrawer } from "./AddMemberDrawer";

vi.mock("../lib/members-api", () => ({
  addMember: vi.fn(),
}));

const successfulResponse = {
  member: {
    id: 42,
    full_name: "Alex Member",
    email: "alex@semo.edu",
    student_id: "S12345678",
    major: "Computer Science",
    graduation_year: 2028,
    role: "general" as const,
    status: "approved" as const,
    position: "member" as const,
  },
  setup_email_sent: true,
};

function renderDrawer(onClose = vi.fn(), onAdded = vi.fn()) {
  return {
    onClose,
    onAdded,
    ...render(
      <AddMemberDrawer open onClose={onClose} onAdded={onAdded} />,
    ),
  };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/First name/i), "Alex");
  await user.type(screen.getByLabelText(/Last name/i), "Member");
  await user.type(screen.getByLabelText(/Student ID/i), "s12345678");
  await user.type(screen.getByLabelText(/Major/i), "Computer Science");
  await user.selectOptions(
    screen.getByLabelText(/Graduation year/i),
    String(new Date().getFullYear()),
  );
  await user.type(screen.getByLabelText(/Email address/i), "ALEX@SEMO.EDU");
}

describe("validateAddMemberForm", () => {
  it("requires identity, university, graduation, and email fields", () => {
    const errors = validateAddMemberForm(EMPTY_ADD_MEMBER_FORM);
    expect(errors.firstName).toBeTruthy();
    expect(errors.lastName).toBeTruthy();
    expect(errors.studentId).toBeTruthy();
    expect(errors.major).toBeTruthy();
    expect(errors.graduationYear).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.phone).toBeUndefined();
  });

  it("rejects non-SEMO emails and malformed student IDs", () => {
    const errors = validateAddMemberForm({
      ...EMPTY_ADD_MEMBER_FORM,
      firstName: "Alex",
      lastName: "Member",
      studentId: "bad!",
      major: "Computer Science",
      graduationYear: String(new Date().getFullYear()),
      email: "alex@gmail.com",
    });
    expect(errors.email).toMatch(/@semo\.edu/i);
    expect(errors.studentId).toMatch(/6–20 letters or numbers/i);
  });
});

describe("AddMemberDrawer", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders only the reviewed member fields", () => {
    renderDrawer();
    const dialog = screen.getByRole("dialog", { name: "Add Member" });

    expect(within(dialog).getByLabelText(/First name/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Last name/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Student ID/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Major/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Graduation year/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Phone number/i)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Organization/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Member role/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Committee/i)).not.toBeInTheDocument();
  });

  it("shows validation feedback for an empty form", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    await user.click(screen.getByRole("button", { name: "Add Member" }));

    expect(
      screen.getByText(/fields need attention before you can add this member/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/First name is required/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("submits normalized data and passes the full response", async () => {
    const user = userEvent.setup();
    vi.mocked(addMember).mockResolvedValue(successfulResponse);
    const { onClose, onAdded } = renderDrawer();
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Add Member" }));

    await waitFor(() => expect(addMember).toHaveBeenCalledOnce());
    expect(addMember).toHaveBeenCalledWith({
      full_name: "Alex Member",
      email: "alex@semo.edu",
      student_id: "S12345678",
      major: "Computer Science",
      graduation_year: new Date().getFullYear(),
      phone: null,
    });
    expect(onAdded).toHaveBeenCalledWith(successfulResponse);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows a duplicate error inline without closing or clearing the draft", async () => {
    const user = userEvent.setup();
    const error = {
      isAxiosError: true,
      response: {
        status: 409,
        data: { detail: "Email already registered" },
      },
    };
    vi.mocked(addMember).mockRejectedValue(error);
    const { onClose, onAdded } = renderDrawer();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Save Draft" }));

    await user.click(screen.getByRole("button", { name: "Add Member" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email already registered",
    );
    expect(onAdded).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      window.localStorage.getItem(ADD_MEMBER_DRAFT_STORAGE_KEY),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Member" })).toBeEnabled();
  });

  it("saves and restores a local draft", async () => {
    const user = userEvent.setup();
    const onAdded = vi.fn();
    const { rerender } = render(
      <AddMemberDrawer open onClose={() => undefined} onAdded={onAdded} />,
    );
    await user.type(screen.getByLabelText(/First name/i), "Alex");
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(screen.getByRole("status")).toHaveTextContent(/Draft saved/i);

    rerender(
      <AddMemberDrawer
        open={false}
        onClose={() => undefined}
        onAdded={onAdded}
      />,
    );
    rerender(
      <AddMemberDrawer open onClose={() => undefined} onAdded={onAdded} />,
    );
    expect(screen.getByLabelText(/First name/i)).toHaveValue("Alex");
  });
});
