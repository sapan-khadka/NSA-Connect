import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

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
  });

  it("renders premium overview with real metadata and honest empties", () => {
    render(
      <MockAuthProvider value={{ member: boardViewer, isAuthenticated: true }}>
        <MemoryRouter>
          <MemberWorkspaceHeader member={member} />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    expect(
      screen.getByRole("link", { name: /Back to Members/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Alex Member" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Board")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();

    const details = screen.getByLabelText("Member details");
    expect(within(details).getByText("Email")).toBeInTheDocument();
    expect(within(details).getByText("alex@semo.edu")).toBeInTheDocument();
    expect(within(details).getByText("Phone")).toBeInTheDocument();
    expect(within(details).getByText("Graduation Year")).toBeInTheDocument();
    expect(within(details).getByText("2028")).toBeInTheDocument();
    expect(within(details).getByText("Joined Organization")).toBeInTheDocument();
    expect(within(details).getAllByText("—").length).toBeGreaterThanOrEqual(2);

    expect(
      screen.getByRole("button", { name: "Edit Member" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("link", { name: "Message Alex Member" }),
    ).toHaveAttribute("href", "mailto:alex@semo.edu");
    expect(
      screen.getByRole("button", { name: "More actions (Coming Soon)" }),
    ).toBeDisabled();
  });

  it("hides Edit Member for general viewers", () => {
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
      screen.getByRole("link", { name: "Message Alex Member" }),
    ).toHaveAttribute("href", "mailto:alex@semo.edu");
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
