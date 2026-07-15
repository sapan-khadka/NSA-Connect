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

vi.mock("../lib/member-notes-api", () => ({
  fetchMemberNotes: vi.fn().mockResolvedValue({
    member_id: 2,
    notes: [],
    total: 0,
  }),
  createMemberNote: vi.fn(),
  updateMemberNote: vi.fn(),
  deleteMemberNote: vi.fn(),
}));

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
    const { fetchMemberDuesHistory } = await import("../lib/dues-api");
    const { fetchTaskOverview } = await import("../lib/event-tasks-api");
    const { fetchMemberNotes } = await import("../lib/member-notes-api");

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
    vi.mocked(fetchMemberDuesHistory).mockResolvedValue({
      member_id: 2,
      records: [
        {
          id: 1,
          member_id: 2,
          semester: "2026-summer",
          amount_owed: "20.00",
          amount_paid: "0.00",
          status: "unpaid",
          paid_at: null,
        },
      ],
      total: 1,
    });

    renderMemberProfile();

    expect(await screen.findByText("Secretary User")).toBeInTheDocument();
    const snapshot = screen.getByLabelText("Today's Snapshot");
    expect(snapshot).toBeInTheDocument();
    expect(within(snapshot).getByText("Active Status")).toBeInTheDocument();
    expect(within(snapshot).getByText("Active")).toBeInTheDocument();
    expect(within(snapshot).getByText("Dues Status")).toBeInTheDocument();
    expect(within(snapshot).getByText("Outstanding")).toBeInTheDocument();
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
    expect(within(finance).getByText(/Outstanding/)).toBeInTheDocument();

    const notes = screen.getByLabelText("Private Notes");
    expect(
      within(notes).getByRole("heading", { name: "Private Notes" }),
    ).toBeInTheDocument();
    expect(fetchMemberNotes).toHaveBeenCalledWith(2);
    expect(
      await within(notes).findByText("No private notes yet."),
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
      within(insights).getByText("Outstanding dues ($20.00)."),
    ).toBeInTheDocument();
  });

  it("hides Private Notes entirely for general members", async () => {
    const { fetchMemberById } = await import("../lib/members-api");
    const { fetchMyDuesHistory } = await import("../lib/dues-api");
    const { fetchMyEventTasks } = await import("../lib/event-tasks-api");
    const { fetchMemberNotes } = await import("../lib/member-notes-api");

    vi.mocked(fetchMemberById).mockResolvedValue({
      ...secretaryMember,
      id: 10,
      role: "general",
      position: "member",
      full_name: "General Self",
      email: "general@semo.edu",
    });
    vi.mocked(fetchMyEventTasks).mockResolvedValue({
      tasks: [],
      total: 0,
    });
    vi.mocked(fetchMyDuesHistory).mockResolvedValue({
      member_id: 10,
      records: [
        {
          id: 1,
          member_id: 10,
          semester: "2026-summer",
          amount_owed: "20.00",
          amount_paid: "20.00",
          status: "paid",
          paid_at: "2026-06-01T12:00:00+00:00",
        },
      ],
      total: 1,
    });

    render(
      <MockAuthProvider
        value={{
          member: {
            id: 10,
            full_name: "General Self",
            email: "general@semo.edu",
            student_id: "11111111",
            major: "Biology",
            graduation_year: 2028,
            role: "general",
            status: "approved",
            position: "member",
          },
          isAuthenticated: true,
        }}
      >
        <MemoryRouter initialEntries={["/members/10"]}>
          <Routes>
            <Route path="/members/:memberId" element={<MemberProfilePage />} />
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>,
    );

    expect(await screen.findByText("General Self")).toBeInTheDocument();
    const snapshot = screen.getByLabelText("Today's Snapshot");
    expect(within(snapshot).getByText("Paid")).toBeInTheDocument();
    expect(screen.queryByLabelText("Private Notes")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Private Notes" }),
    ).not.toBeInTheDocument();
    expect(fetchMemberNotes).not.toHaveBeenCalled();
  });
});