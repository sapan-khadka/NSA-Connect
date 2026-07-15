import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import { MockAuthProvider } from "../test/test-utils";

import { MemberProfilePage } from "./MemberProfilePage";

vi.mock("../lib/members-api", () => ({
  fetchMemberById: vi.fn(),
  fetchMemberActivity: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  fetchMemberMeetingAttendanceStreak: vi.fn().mockResolvedValue({
    member_id: 2,
    consecutive_missed_meetings: 0,
  }),
}));

vi.mock("../lib/member-documents-api", async () => {
  const actual = await vi.importActual("../lib/member-documents-api");
  return {
    ...actual,
    fetchMemberDocuments: vi.fn().mockResolvedValue({
      member_id: 2,
      documents: [],
      total: 0,
    }),
    uploadMemberDocument: vi.fn(),
    deleteMemberDocument: vi.fn(),
  };
});

vi.mock("../lib/dues-api", () => ({
  fetchDuesDashboard: vi.fn(),
  fetchMyDuesHistory: vi.fn().mockResolvedValue({
    member_id: 2,
    records: [],
    total: 0,
  }),
  fetchMemberDuesHistory: vi.fn().mockResolvedValue({
    member_id: 2,
    records: [],
    total: 0,
  }),
}));

vi.mock("../lib/event-tasks-api", () => ({
  fetchTaskOverview: vi.fn(),
  fetchMyEventTasks: vi.fn(),
}));

vi.mock("../lib/events-api", () => ({
  fetchUpcomingEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
  fetchEventAttendees: vi.fn(),
  fetchEventVolunteerSignups: vi.fn(),
}));

vi.mock("../lib/volunteer-api", () => ({
  fetchMyVolunteerSignups: vi.fn().mockResolvedValue({ signups: [], total: 0 }),
}));

vi.mock("../lib/meetings-api", () => ({
  fetchMeetings: vi.fn().mockResolvedValue({ meetings: [], total: 0 }),
}));

const secretaryMember: MemberResponse = {
  id: 2,
  full_name: "Secretary User",
  email: "secretary@semo.edu",
  student_id: "12345678",
  major: "Biology",
  graduation_year: 2028,
  role: "board",
  status: "approved",
  position: "secretary",
};

function renderMemberProfile() {
  return render(
    <MockAuthProvider
      value={{
        member: {
          id: 1,
          full_name: "President User",
          email: "president@semo.edu",
          student_id: "87654321",
          major: "Administration",
          graduation_year: 2028,
          role: "president",
          status: "approved",
          position: "president",
        },
        isAuthenticated: true,
      }}
    >
      <MemoryRouter initialEntries={["/members/2"]}>
        <Routes>
          <Route path="/members/:memberId" element={<MemberProfilePage />} />
        </Routes>
      </MemoryRouter>
    </MockAuthProvider>,
  );
}

describe("MemberProfilePage today's snapshot", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders Today's Snapshot chips from real member, tasks, and dues", async () => {
    const { fetchMemberById } = await import("../lib/members-api");
    const { fetchDuesDashboard } = await import("../lib/dues-api");
    const { fetchTaskOverview } = await import("../lib/event-tasks-api");

    vi.mocked(fetchMemberById).mockResolvedValue(secretaryMember);
    vi.mocked(fetchTaskOverview).mockResolvedValue({
      members: [
        {
          member_id: 2,
          full_name: "Secretary User",
          role: "board",
          position: "secretary",
          total: 4,
          completed: 1,
          in_progress: 1,
          todo: 2,
          completion_percent: 25,
          tasks: [
            {
              id: 9,
              event_id: 5,
              event_name: "Dashain Celebration",
              task_kind: "simple",
              title: "Book venue",
              group_name: null,
              description: "",
              assignee_id: 2,
              assignee_name: "Secretary User",
              status: "todo",
              due_date: "2030-05-20T12:00:00+00:00",
              is_overdue: false,
              is_complete: false,
              checklist_items: [],
              completion_note: null,
              completion_photo_url: null,
              completed_at: null,
              created_by_id: 1,
              created_at: "2030-05-01T12:00:00+00:00",
            },
            {
              id: 10,
              event_id: 5,
              event_name: "Dashain Celebration",
              task_kind: "simple",
              title: "Done already",
              group_name: null,
              description: "",
              assignee_id: 2,
              assignee_name: "Secretary User",
              status: "done",
              due_date: null,
              is_overdue: false,
              is_complete: true,
              checklist_items: [],
              completion_note: null,
              completion_photo_url: null,
              completed_at: "2030-05-02T12:00:00+00:00",
              created_by_id: 1,
              created_at: "2030-05-01T12:00:00+00:00",
            },
          ],
        },
      ],
      total_tasks: 4,
      completed_tasks: 1,
    });
    vi.mocked(fetchDuesDashboard).mockResolvedValue({
      summary: {
        semester: "2026-summer",
        default_amount: "20.00",
        total_expected: "20",
        total_collected: "0",
        total_outstanding: "20",
        paid_count: 0,
        unpaid_count: 1,
        partial_count: 0,
        exempt_count: 0,
        member_count: 1,
      },
      records: [
        {
          id: 1,
          member_id: 2,
          member_name: "Secretary User",
          member_email: "secretary@semo.edu",
          semester: "2026-summer",
          amount_owed: "20.00",
          amount_paid: "0.00",
          status: "unpaid",
          paid_at: null,
          payment_method: null,
          note: null,
          finance_entry_id: null,
        },
      ],
    });

    renderMemberProfile();

    expect(await screen.findByText("Secretary User")).toBeInTheDocument();
    const snapshot = screen.getByLabelText("Today's Snapshot");
    expect(snapshot).toBeInTheDocument();
    expect(within(snapshot).getByText("Active Status")).toBeInTheDocument();
    expect(within(snapshot).getByText("Active")).toBeInTheDocument();
    expect(within(snapshot).getByText("Dues Status")).toBeInTheDocument();
    expect(within(snapshot).getByText("Unpaid")).toBeInTheDocument();
    expect(within(snapshot).getByText("Next Event RSVP")).toBeInTheDocument();
    expect(within(snapshot).getByText("Open Tasks")).toBeInTheDocument();
    expect(within(snapshot).getByText("3")).toBeInTheDocument();
    expect(
      within(snapshot).getByText("Board / Committee Role"),
    ).toBeInTheDocument();
    expect(within(snapshot).getByText("Board · Secretary")).toBeInTheDocument();
    expect(within(snapshot).getByText("Graduation Year")).toBeInTheDocument();
    expect(within(snapshot).getByText("2028")).toBeInTheDocument();

    const responsibilities = screen.getByLabelText("Current Responsibilities");
    expect(
      within(responsibilities).getByRole("heading", {
        name: "Current Responsibilities",
      }),
    ).toBeInTheDocument();
    expect(within(responsibilities).getByText("Book venue")).toBeInTheDocument();
    expect(
      within(responsibilities).queryByText("Done already"),
    ).not.toBeInTheDocument();
    expect(
      within(responsibilities).getByRole("link", { name: "Open Book venue" }),
    ).toHaveAttribute("href", "/events/5/manage");

    const schedule = screen.getByLabelText("Upcoming Schedule");
    expect(
      within(schedule).getByRole("heading", { name: "Upcoming Schedule" }),
    ).toBeInTheDocument();
    expect(
      within(schedule).getByText("Nothing on the schedule yet."),
    ).toBeInTheDocument();

    const activity = screen.getByLabelText("Recent Activity");
    expect(
      within(activity).getByRole("heading", { name: "Recent Activity" }),
    ).toBeInTheDocument();
    expect(
      within(activity).getByText("No recent activity yet."),
    ).toBeInTheDocument();

    const finance = screen.getByLabelText("Financial Status");
    expect(
      within(finance).getByRole("heading", { name: "Financial Status" }),
    ).toBeInTheDocument();
    expect(
      within(finance).getByText("No dues on record yet."),
    ).toBeInTheDocument();

    const documents = screen.getByLabelText("Documents");
    expect(
      within(documents).getByRole("heading", { name: "Documents" }),
    ).toBeInTheDocument();
    expect(
      await within(documents).findByText("No documents on file."),
    ).toBeInTheDocument();

    const insights = screen.getByLabelText("AI Insights");
    expect(
      within(insights).getByRole("heading", { name: "AI Insights" }),
    ).toBeInTheDocument();
    expect(
      within(insights).getByText("No notable patterns right now."),
    ).toBeInTheDocument();
  });
});
