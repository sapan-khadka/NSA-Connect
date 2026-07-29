import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import type { MemberDuesRecord } from "../lib/dues-api";
import { MockAuthProvider } from "../test/test-utils";
import { MemberQuickViewDrawer } from "./MemberQuickViewDrawer";

vi.mock("../lib/members-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/members-api")>(
    "../lib/members-api",
  );
  return {
    ...actual,
    fetchMemberActivity: vi.fn(),
  };
});

vi.mock("../lib/event-tasks-api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/event-tasks-api")>(
      "../lib/event-tasks-api",
    );
  return {
    ...actual,
    fetchTaskOverview: vi.fn(),
    fetchMyEventTasks: vi.fn(),
  };
});

vi.mock("../lib/member-workspace-schedule", async () => {
  const actual = await vi.importActual<
    typeof import("../lib/member-workspace-schedule")
  >("../lib/member-workspace-schedule");
  return {
    ...actual,
    fetchMemberWorkspaceSchedule: vi.fn(),
  };
});

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

const viewer: MemberResponse = {
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

function renderQuickView(ui: ReactElement) {
  return render(
    <MockAuthProvider value={{ member: viewer, isAuthenticated: true }}>
      {ui}
    </MockAuthProvider>,
  );
}

describe("MemberQuickViewDrawer", () => {
  beforeEach(async () => {
    const { fetchMemberActivity } = await import("../lib/members-api");
    const { fetchTaskOverview, fetchMyEventTasks } = await import(
      "../lib/event-tasks-api"
    );
    const { fetchMemberWorkspaceSchedule } = await import(
      "../lib/member-workspace-schedule"
    );
    vi.mocked(fetchMemberActivity).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(fetchTaskOverview).mockResolvedValue({ members: [] } as never);
    vi.mocked(fetchMyEventTasks).mockResolvedValue({ tasks: [] } as never);
    vi.mocked(fetchMemberWorkspaceSchedule).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders compact header, detail rows, and text profile CTA", async () => {
    renderQuickView(
      <MemoryRouter>
        <MemberQuickViewDrawer
          member={member}
          open
          onClose={() => undefined}
          duesRecord={duesRecord}
          engagement="active"
          activityItems={[]}
        />
      </MemoryRouter>,
    );

    const dialog = screen.getByRole("dialog", { name: /Alex Member/i });
    expect(within(dialog).getByText("Alex Member")).toBeInTheDocument();
    expect(within(dialog).getByText("alex@semo.edu")).toBeInTheDocument();
    expect(within(dialog).getByText(/Board · Active/)).toBeInTheDocument();

    const details = within(dialog).getByLabelText("Member facts");
    expect(within(details).getByText("Graduation")).toBeInTheDocument();
    expect(within(details).getByText("2028")).toBeInTheDocument();
    expect(within(details).getByText("Major")).toBeInTheDocument();
    expect(within(details).getByText("Computer Science")).toBeInTheDocument();
    expect(within(details).getByText("Outstanding")).toBeInTheDocument();
    expect(within(details).getByText("$15")).toBeInTheDocument();
    expect(within(details).queryByText("Attendance")).not.toBeInTheDocument();

    expect(
      within(dialog).getByRole("heading", { name: "Responsibilities" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Board member")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Upcoming" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("No upcoming events.")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Recent Activity" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("No activity yet.")).toBeInTheDocument();

    expect(
      within(dialog).getByRole("link", { name: /View full profile/i }),
    ).toHaveAttribute("href", "/members/3");
    expect(
      within(dialog).queryByRole("button", { name: "View Full Profile" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Edit / Message / Email in the overflow menu", async () => {
    const user = userEvent.setup();
    const onEditMember = vi.fn();

    renderQuickView(
      <MemoryRouter>
        <MemberQuickViewDrawer
          member={member}
          open
          onClose={() => undefined}
          onEditMember={onEditMember}
          activityItems={[]}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "More actions" }));
    const menu = screen.getByRole("menu", { name: "Member actions" });
    await user.click(within(menu).getByRole("menuitem", { name: "Edit" }));
    expect(onEditMember).toHaveBeenCalledWith(member);

    await user.click(screen.getByRole("button", { name: "More actions" }));
    const openMenu = screen.getByRole("menu", { name: "Member actions" });
    expect(
      within(openMenu).getByRole("menuitem", { name: "Email" }),
    ).toHaveAttribute("href", "mailto:alex@semo.edu");
    expect(
      within(openMenu).getByRole("menuitem", { name: "Message" }),
    ).toBeEnabled();
  });

  it("renders provided activity items when available", () => {
    renderQuickView(
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
    expect(screen.queryByText("No activity yet.")).not.toBeInTheDocument();
  });

  it("hides when closed", () => {
    const { container } = renderQuickView(
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

    renderQuickView(
      <MemoryRouter>
        <MemberQuickViewDrawer
          member={member}
          open
          onClose={onClose}
          activityItems={[]}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
