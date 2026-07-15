import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import type { MemberResponse } from "../../lib/auth-api";
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

describe("MemberWorkspaceHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders premium overview with real metadata and honest empties", () => {
    render(
      <MemoryRouter>
        <MemberWorkspaceHeader member={member} />
      </MemoryRouter>,
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
      screen.getByRole("button", { name: "Edit Member (Coming Soon)" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Message (Coming Soon)" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "More actions (Coming Soon)" }),
    ).toBeDisabled();
  });

  it("shows committee badge only when provided", () => {
    const { rerender } = render(
      <MemoryRouter>
        <MemberWorkspaceHeader member={member} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Events")).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <MemberWorkspaceHeader member={member} committee="Events" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Events")).toBeInTheDocument();
  });
});
