import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import { MockAuthProvider } from "../test/test-utils";
import { AnnouncementsPage } from "./AnnouncementsPage";

vi.mock("../lib/announcements-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/announcements-api")>(
    "../lib/announcements-api",
  );
  return {
    ...actual,
    fetchAnnouncements: vi.fn(),
    createAnnouncement: vi.fn(),
    updateAnnouncement: vi.fn(),
    deleteAnnouncement: vi.fn(),
  };
});

const boardMember: MemberResponse = {
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

function renderPage(
  role: MemberResponse["role"] = "board",
  initialPath = "/announcements",
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MockAuthProvider
        value={{
          member: { ...boardMember, role },
          isAuthenticated: true,
        }}
      >
        <AnnouncementsPage />
      </MockAuthProvider>
    </MemoryRouter>,
  );
}

describe("AnnouncementsPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders polished Linear-style rows with compact meta", async () => {
    const { fetchAnnouncements } = await import("../lib/announcements-api");
    vi.mocked(fetchAnnouncements).mockResolvedValue({
      total: 2,
      announcements: [
        {
          id: 1,
          title: "Semester Kickoff",
          body: "Welcome back everyone.",
          category: "general",
          audience: "all_approved",
          event_id: null,
          is_pinned: true,
          author: { id: 2, full_name: "Mukesh", avatar_url: null },
          created_at: "2026-07-24T12:00:00Z",
          updated_at: "2026-07-24T12:00:00Z",
        },
        {
          id: 2,
          title: "Dashain Celebration",
          body: "We're celebrating Dashain on August 4.",
          category: "event_related",
          audience: "going",
          event_id: 9,
          is_pinned: false,
          author: { id: 3, full_name: "Apsana", avatar_url: null },
          created_at: "2026-07-21T21:54:00Z",
          updated_at: "2026-07-21T21:54:00Z",
        },
      ],
    });

    renderPage("president");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Announcements" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Chapter updates, event notices, and urgent reminders."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /New announcement/i }),
    ).toBeInTheDocument();

    const feed = await screen.findByRole("feed", { name: "Announcements" });
    expect(
      within(feed).getByRole("heading", { name: "Pinned" }),
    ).toBeInTheDocument();
    expect(
      within(feed).getByRole("heading", { name: "Recent" }),
    ).toBeInTheDocument();
    expect(within(feed).getByText("Semester Kickoff")).toBeInTheDocument();
    expect(within(feed).getByText("Dashain Celebration")).toBeInTheDocument();
    expect(
      within(feed).getByText("We're celebrating Dashain on August 4."),
    ).toBeInTheDocument();
    expect(within(feed).getByText("Mukesh")).toBeInTheDocument();
    expect(within(feed).getByText("Apsana")).toBeInTheDocument();
    expect(within(feed).getByText("General")).toBeInTheDocument();
    expect(within(feed).getByText("Event")).toBeInTheDocument();
    expect(within(feed).getByText("Jul 24")).toBeInTheDocument();
    expect(within(feed).getByText("Jul 21")).toBeInTheDocument();
    // Default "Everyone" audience is omitted; non-default still shows.
    expect(within(feed).queryByText("Everyone")).not.toBeInTheDocument();
    expect(within(feed).getByText("Going")).toBeInTheDocument();
    expect(
      within(feed).queryByRole("link", { name: /related event/i }),
    ).not.toBeInTheDocument();
  });

  it("opens an announcement when its row is clicked", async () => {
    const user = userEvent.setup();
    const { fetchAnnouncements } = await import("../lib/announcements-api");
    vi.mocked(fetchAnnouncements).mockResolvedValue({
      total: 1,
      announcements: [
        {
          id: 2,
          title: "Dashain Celebration",
          body: "We're celebrating Dashain on August 4.",
          category: "event_related",
          audience: "all_approved",
          event_id: 9,
          is_pinned: false,
          author: { id: 3, full_name: "Apsana", avatar_url: null },
          created_at: "2026-07-21T21:54:00Z",
          updated_at: "2026-07-21T21:54:00Z",
        },
      ],
    });

    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Open Dashain Celebration" }),
    );

    expect(
      await screen.findByRole("link", { name: "View related event" }),
    ).toHaveAttribute("href", "/events/9");
    expect(screen.getAllByText("Dashain Celebration").length).toBeGreaterThan(0);
  });

  it("filters the feed by category and search", async () => {
    const user = userEvent.setup();
    const { fetchAnnouncements } = await import("../lib/announcements-api");
    vi.mocked(fetchAnnouncements).mockResolvedValue({
      total: 2,
      announcements: [
        {
          id: 1,
          title: "Dashain Celebration",
          body: "Festival night",
          category: "event_related",
          audience: "all_approved",
          event_id: null,
          is_pinned: false,
          author: { id: 2, full_name: "Mukesh" },
          created_at: "2026-07-21T21:54:00Z",
          updated_at: "2026-07-21T21:54:00Z",
        },
        {
          id: 2,
          title: "Board Sync",
          body: "Agenda attached",
          category: "urgent",
          audience: "all_approved",
          event_id: null,
          is_pinned: false,
          author: { id: 3, full_name: "Secretary" },
          created_at: "2026-07-20T12:00:00Z",
          updated_at: "2026-07-20T12:00:00Z",
        },
      ],
    });

    renderPage();

    await screen.findByText("Dashain Celebration");
    await user.click(screen.getByRole("button", { name: "Events" }));
    expect(screen.getByText("Dashain Celebration")).toBeInTheDocument();
    expect(screen.queryByText("Board Sync")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));
    await user.type(
      screen.getByPlaceholderText("Search announcements"),
      "board",
    );
    await waitFor(() => {
      expect(screen.getByText("Board Sync")).toBeInTheDocument();
      expect(screen.queryByText("Dashain Celebration")).not.toBeInTheDocument();
    });
  });

  it("shows an empty state with create action when there are no announcements", async () => {
    const user = userEvent.setup();
    const { fetchAnnouncements } = await import("../lib/announcements-api");
    vi.mocked(fetchAnnouncements).mockResolvedValue({
      total: 0,
      announcements: [],
    });

    renderPage("board");

    expect(
      await screen.findByText("No announcements yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Create your first announcement to keep members informed.",
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Create announcement/i }),
    );
    expect(
      screen.getByRole("heading", { name: "New announcement" }),
    ).toBeInTheDocument();
  });

  it("opens the composer from the global Create deep link", async () => {
    const { fetchAnnouncements } = await import("../lib/announcements-api");
    vi.mocked(fetchAnnouncements).mockResolvedValue({
      total: 0,
      announcements: [],
    });

    renderPage("board", "/announcements?create=1");

    expect(
      await screen.findByRole("heading", { name: "New announcement" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post" })).toBeInTheDocument();
  });

  it("keeps pin/edit/delete inside the hover overflow menu", async () => {
    const user = userEvent.setup();
    const { fetchAnnouncements, updateAnnouncement } = await import(
      "../lib/announcements-api"
    );
    vi.mocked(fetchAnnouncements).mockResolvedValue({
      total: 1,
      announcements: [
        {
          id: 1,
          title: "Kickoff",
          body: "Welcome back",
          category: "general",
          audience: "all_approved",
          event_id: null,
          is_pinned: false,
          author: { id: 2, full_name: "Mukesh" },
          created_at: "2026-07-21T21:54:00Z",
          updated_at: "2026-07-21T21:54:00Z",
        },
      ],
    });
    vi.mocked(updateAnnouncement).mockResolvedValue({
      id: 1,
      title: "Kickoff",
      body: "Welcome back",
      category: "general",
      audience: "all_approved",
      event_id: null,
      is_pinned: true,
      author: { id: 2, full_name: "Mukesh" },
      created_at: "2026-07-21T21:54:00Z",
      updated_at: "2026-07-21T21:54:00Z",
    });

    renderPage("board");

    await screen.findByText("Kickoff");
    await user.click(screen.getByRole("button", { name: "Actions for Kickoff" }));
    const menu = screen.getByRole("menu", { name: "Announcement actions" });
    expect(within(menu).getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Pin" })).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Delete" }),
    ).toBeInTheDocument();

    await user.click(within(menu).getByRole("menuitem", { name: "Pin" }));
    await waitFor(() => {
      expect(updateAnnouncement).toHaveBeenCalledWith(1, { is_pinned: true });
    });
  });
});
