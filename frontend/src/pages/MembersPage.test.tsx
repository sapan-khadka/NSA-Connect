import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { MockAuthProvider } from "../test/test-utils";

import { MembersPage } from "./MembersPage";

function renderMembersPage() {
  return render(
    <MockAuthProvider
      value={{
        member: {
          id: 1,
          full_name: "Board User",
          email: "board@semo.edu",
          student_id: "87654321",
          major: "Administration",
          graduation_year: 2028,
          role: "board",
          status: "approved",
          position: "member",
        },
        isAuthenticated: true,
      }}
    >
      <MemoryRouter initialEntries={["/members"]}>
        <MembersPage />
      </MemoryRouter>
    </MockAuthProvider>,
  );
}

describe("MembersPage layout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the header with subtitle and actions", () => {
    renderMembersPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Members" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Manage everyone in your organization."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Invite Member" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import CSV" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("renders layout shells for statistics, filters, and table", () => {
    renderMembersPage();

    expect(screen.getByLabelText("Statistics")).toBeInTheDocument();
    expect(screen.getByLabelText("Search and filters")).toBeInTheDocument();
    expect(screen.getByLabelText("Member table")).toBeInTheDocument();
  });

  it("opens the Invite Member drawer from the header", async () => {
    const user = userEvent.setup();
    renderMembersPage();

    await user.click(screen.getByRole("button", { name: "Invite Member" }));

    const drawer = screen.getByRole("dialog", { name: "Invite Member" });
    expect(drawer).toBeInTheDocument();
    expect(
      within(drawer).getByRole("heading", { name: "Personal Information" }),
    ).toBeInTheDocument();
  });
});
