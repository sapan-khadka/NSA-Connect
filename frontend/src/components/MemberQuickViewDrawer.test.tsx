import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import { MemberQuickViewDrawer } from "./MemberQuickViewDrawer";

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
};

describe("MemberQuickViewDrawer", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders avatar summary, metrics, activity, and actions", () => {
    render(
      <MemoryRouter>
        <MemberQuickViewDrawer member={member} open onClose={() => undefined} />
      </MemoryRouter>,
    );

    const dialog = screen.getByRole("dialog", { name: "Alex Member" });
    expect(
      within(dialog).getByRole("heading", { name: "Alex Member" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("alex@semo.edu")).toBeInTheDocument();
    expect(within(dialog).getByText("Approved")).toBeInTheDocument();

    const overview = within(dialog).getByLabelText("Member overview");
    expect(within(overview).getByText("Role")).toBeInTheDocument();
    expect(within(overview).getByText("Board")).toBeInTheDocument();
    expect(within(overview).getByText("Committee")).toBeInTheDocument();
    expect(within(overview).getByText("Health Score")).toBeInTheDocument();
    expect(within(overview).getByText("Attendance")).toBeInTheDocument();
    expect(within(overview).getByText("Task Completion")).toBeInTheDocument();
    expect(within(overview).getByText("Payment Status")).toBeInTheDocument();
    expect(within(overview).getByText("Recent Activity")).toBeInTheDocument();

    expect(
      within(dialog).getByRole("heading", { name: "Suggestions" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Recent Activity" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("No recent activity")).toBeInTheDocument();

    expect(
      within(dialog).getByRole("button", { name: "View Profile" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Message (coming soon)" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Edit" }),
    ).toBeInTheDocument();
  });

  it("hides when closed", () => {
    const { container } = render(
      <MemoryRouter>
        <MemberQuickViewDrawer
          member={member}
          open={false}
          onClose={() => undefined}
        />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("closes from the drawer close control", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <MemoryRouter>
        <MemberQuickViewDrawer member={member} open onClose={onClose} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
