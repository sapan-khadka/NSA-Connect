import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../../lib/auth-api";
import { MockAuthProvider } from "../../test/test-utils";
import { MemberWorkspaceHeader } from "./MemberWorkspaceHeader";

const member: MemberResponse = {
  id: 3,
  full_name: "Alex Member",
  email: "alex@semo.edu",
  student_id: "S87654321",
  major: "Computer Science",
  graduation_year: 2028,
  role: "board",
  status: "approved",
  position: "member",
  phone: null,
};

const boardViewer: MemberResponse = {
  id: 1,
  full_name: "Board Viewer",
  email: "board@semo.edu",
  student_id: "11111111",
  major: "CS",
  graduation_year: 2027,
  role: "board",
  status: "approved",
  position: "member",
};

describe("MemberWorkspaceHeader", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders compact overview with Edit Member and overflow only", () => {
    render(
      <MockAuthProvider value={{ member: boardViewer, isAuthenticated: true }}>
        <MemoryRouter>
          <MemberWorkspaceHeader member={member} />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    expect(
      screen.getByRole("link", { name: /^Members$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Alex Member" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Board")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();

    const details = screen.getByLabelText("Member details");
    expect(within(details).getByText("alex@semo.edu")).toBeInTheDocument();
    expect(within(details).getByText("Class of 2028")).toBeInTheDocument();
    expect(within(details).getByText(/Joined/)).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Edit Member" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "More actions" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Message Alex Member" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Email Alex Member" }),
    ).not.toBeInTheDocument();
  });

  it("hides Edit Member for general viewers but keeps overflow", () => {
    render(
      <MockAuthProvider
        value={{
          member: { ...boardViewer, id: 9, role: "general" },
          isAuthenticated: true,
        }}
      >
        <MemoryRouter>
          <MemberWorkspaceHeader member={member} />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Edit Member" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More actions" }),
    ).toBeEnabled();
  });

  it("opens a grouped overflow menu with communication and admin actions", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <MockAuthProvider value={{ member: boardViewer, isAuthenticated: true }}>
        <MemoryRouter>
          <MemberWorkspaceHeader member={member} />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Communication")).toBeInTheDocument();
    expect(within(menu).getByText("Member")).toBeInTheDocument();
    expect(within(menu).getByText("Danger")).toBeInTheDocument();

    expect(within(menu).getByRole("menuitem", { name: "Message" })).toBeEnabled();
    expect(within(menu).getByRole("menuitem", { name: "Email" })).toHaveAttribute(
      "href",
      "mailto:alex@semo.edu",
    );
    expect(within(menu).getByRole("menuitem", { name: "Copy email" })).toBeEnabled();
    expect(
      within(menu).getByRole("menuitem", { name: "Change role" }),
    ).toBeDisabled();
    expect(
      within(menu).getByRole("menuitem", { name: "Reset password" }),
    ).toBeDisabled();
    expect(
      within(menu).getByRole("menuitem", { name: "Archive member" }),
    ).toBeDisabled();
    expect(
      within(menu).getByRole("menuitem", { name: "Delete member" }),
    ).toBeDisabled();

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Copy email" }));
    expect(writeText).toHaveBeenCalledWith("alex@semo.edu");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("shows committee badge only when provided", () => {
    const { rerender } = render(
      <MockAuthProvider value={{ member: boardViewer, isAuthenticated: true }}>
        <MemoryRouter>
          <MemberWorkspaceHeader member={member} />
        </MemoryRouter>
      </MockAuthProvider>,
    );
    expect(screen.queryByText("Events")).not.toBeInTheDocument();

    rerender(
      <MockAuthProvider value={{ member: boardViewer, isAuthenticated: true }}>
        <MemoryRouter>
          <MemberWorkspaceHeader member={member} committee="Events" />
        </MemoryRouter>
      </MockAuthProvider>,
    );
    expect(screen.getByText("Events")).toBeInTheDocument();
  });
});
