import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import type { MemberDuesRecord } from "../lib/dues-api";
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

const duesRecord: MemberDuesRecord = {
  id: 10,
  member_id: 3,
  member_name: "Alex Member",
  member_email: "alex@semo.edu",
  semester: "2026-summer",
  amount_owed: "20.00",
  amount_paid: "5.00",
  status: "partial",
  paid_at: null,
  payment_method: null,
  note: null,
  finance_entry_id: null,
};

describe("MemberQuickViewDrawer", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders header, honest quick stats, empty activity, and actions", () => {
    render(
      <MemoryRouter>
        <MemberQuickViewDrawer
          member={member}
          open
          onClose={() => undefined}
          duesRecord={duesRecord}
        />
      </MemoryRouter>,
    );

    const dialog = screen.getByRole("dialog", { name: /Alex Member/i });
    expect(within(dialog).getByText("Alex Member")).toBeInTheDocument();
    expect(within(dialog).getByText("alex@semo.edu")).toBeInTheDocument();
    expect(within(dialog).getByText("Board")).toBeInTheDocument();
    expect(within(dialog).getByText("Active")).toBeInTheDocument();

    const overview = within(dialog).getByLabelText("Quick stats");
    expect(within(overview).getByText("Outstanding Dues")).toBeInTheDocument();
    expect(within(overview).getByText("$15.00")).toBeInTheDocument();
    expect(within(overview).getByText("Graduation Year")).toBeInTheDocument();
    expect(within(overview).getByText("2028")).toBeInTheDocument();
    expect(within(overview).getByText("Major")).toBeInTheDocument();
    expect(within(overview).getByText("Computer Science")).toBeInTheDocument();
    expect(within(overview).queryByText("Attendance")).not.toBeInTheDocument();
    expect(within(overview).queryByText("Committee")).not.toBeInTheDocument();

    expect(
      within(dialog).getByRole("heading", { name: "Recent Activity" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("No recent activity yet."),
    ).toBeInTheDocument();

    expect(
      within(dialog).getByRole("button", { name: "View Full Profile" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Edit Member" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", {
        name: "Send Message to Alex Member",
      }),
    ).toHaveAttribute("href", "mailto:alex@semo.edu");
  });

  it("shows Edit Member when onEditMember is provided", async () => {
    const user = userEvent.setup();
    const onEditMember = vi.fn();

    render(
      <MemoryRouter>
        <MemberQuickViewDrawer
          member={member}
          open
          onClose={() => undefined}
          onEditMember={onEditMember}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Edit Member" }));
    expect(onEditMember).toHaveBeenCalledWith(member);
  });

  it("renders provided activity items when available", () => {
    render(
      <MemoryRouter>
        <MemberQuickViewDrawer
          member={member}
          open
          onClose={() => undefined}
          activityItems={[
            {
              id: "1",
              label: "Joined organization",
              occurredAtLabel: "Jan 12",
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Joined organization")).toBeInTheDocument();
    expect(screen.getByText("Jan 12")).toBeInTheDocument();
    expect(
      screen.queryByText("No recent activity yet."),
    ).not.toBeInTheDocument();
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
