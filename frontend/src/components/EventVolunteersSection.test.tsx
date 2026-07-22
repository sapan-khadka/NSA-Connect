import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventVolunteersSection } from "./EventVolunteersSection";

vi.mock("../lib/events-api", () => ({
  fetchEventVolunteerSignups: vi.fn(),
  reviewEventVolunteerSignup: vi.fn(),
}));

import {
  fetchEventVolunteerSignups,
  reviewEventVolunteerSignup,
} from "../lib/events-api";

const mockedFetch = vi.mocked(fetchEventVolunteerSignups);
const mockedReview = vi.mocked(reviewEventVolunteerSignup);

describe("EventVolunteersSection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders volunteer signups with name, note, and signup time", async () => {
    mockedFetch.mockResolvedValue({
      total: 1,
      signups: [
        {
          id: 1,
          member_id: 6,
          full_name: "apsana",
          note: "i can help with the decoration.",
          status: "pending",
          created_at: "2026-07-06T01:01:06.266733Z",
        },
      ],
    });

    render(
      <MemoryRouter>
        <EventVolunteersSection eventId={15} eventName="tihar" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("apsana")).toBeInTheDocument();
    expect(
      screen.getByText("i can help with the decoration."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "apsana" })).toHaveAttribute(
      "href",
      "/members/6",
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows empty state when no one has signed up", async () => {
    mockedFetch.mockResolvedValue({ total: 0, signups: [] });

    render(
      <MemoryRouter>
        <EventVolunteersSection eventId={15} eventName="tihar" />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("No volunteer signups yet."),
    ).toBeInTheDocument();
  });

  it("shows assign-as-task only for approved volunteers", async () => {
    const onConvertToTask = vi.fn();
    mockedFetch.mockResolvedValue({
      total: 1,
      signups: [
        {
          id: 1,
          member_id: 6,
          full_name: "apsana",
          note: "i can help with the decoration.",
          status: "approved",
          created_at: "2026-07-06T01:01:06.266733Z",
        },
      ],
    });

    render(
      <MemoryRouter>
        <EventVolunteersSection
          eventId={15}
          eventName="tihar"
          canAssignTasks
          onConvertToTask={onConvertToTask}
        />
      </MemoryRouter>,
    );

    const button = await screen.findByRole("button", { name: "Assign as task" });
    button.click();
    expect(onConvertToTask).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "apsana",
        status: "approved",
      }),
    );
  });

  it("approves a pending volunteer request", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({
      total: 1,
      signups: [
        {
          id: 1,
          member_id: 6,
          full_name: "apsana",
          note: "i can help with the decoration.",
          status: "pending",
          created_at: "2026-07-06T01:01:06.266733Z",
        },
      ],
    });
    mockedReview.mockResolvedValue({
      id: 1,
      member_id: 6,
      full_name: "apsana",
      note: "i can help with the decoration.",
      status: "approved",
      created_at: "2026-07-06T01:01:06.266733Z",
      reviewed_at: "2026-07-07T01:01:06.266733Z",
    });

    render(
      <MemoryRouter>
        <EventVolunteersSection
          eventId={15}
          eventName="tihar"
          canReviewVolunteers
        />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => {
      expect(mockedReview).toHaveBeenCalledWith(15, 1, "approved");
    });
    expect(await screen.findByText("Approved")).toBeInTheDocument();
  });
});
