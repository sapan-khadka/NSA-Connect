import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider } from "../test/test-utils";
import { MyTasksPage } from "./MyTasksPage";

vi.mock("../lib/volunteer-api", () => ({
  fetchMyVolunteerSignups: vi.fn(),
}));

const mockSignups = {
  signups: [
    {
      id: 1,
      slot_id: 10,
      task_name: "Setup crew",
      event_id: 5,
      event_name: "Dashain Celebration",
      event_starts_at: "2030-06-01T18:00:00+00:00",
      signed_up_at: "2030-05-01T12:00:00+00:00",
      is_done: false,
    },
    {
      id: 2,
      slot_id: 11,
      task_name: "Food station",
      event_id: 4,
      event_name: "Holi Festival",
      event_starts_at: "2020-06-01T18:00:00+00:00",
      signed_up_at: "2020-05-01T12:00:00+00:00",
      is_done: true,
    },
  ],
  total: 2,
};

describe("MyTasksPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows upcoming and done volunteer signups", async () => {
    const { fetchMyVolunteerSignups } = await import("../lib/volunteer-api");
    vi.mocked(fetchMyVolunteerSignups).mockResolvedValue(mockSignups);

    render(
      <MockAuthProvider
        value={{
          member: {
            id: 1,
            full_name: "Test User",
            email: "test@semo.edu",
            student_id: "12345678",
            major: "Computer Science",
            graduation_year: 2028,
            role: "general",
            status: "approved",
          },
          isAuthenticated: true,
        }}
      >
        <MemoryRouter>
          <MyTasksPage />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    expect(await screen.findByText("Setup crew")).toBeInTheDocument();
    expect(screen.getByText("Food station")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Done" })).toBeInTheDocument();
  });

  it("shows empty state when member has no signups", async () => {
    const { fetchMyVolunteerSignups } = await import("../lib/volunteer-api");
    vi.mocked(fetchMyVolunteerSignups).mockResolvedValue({ signups: [], total: 0 });

    render(
      <MockAuthProvider
        value={{
          member: {
            id: 1,
            full_name: "Test User",
            email: "test@semo.edu",
            student_id: "12345678",
            major: "Computer Science",
            graduation_year: 2028,
            role: "general",
            status: "approved",
          },
          isAuthenticated: true,
        }}
      >
        <MemoryRouter>
          <MyTasksPage />
        </MemoryRouter>
      </MockAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("No volunteer tasks yet")).toBeInTheDocument();
    });
  });
});
