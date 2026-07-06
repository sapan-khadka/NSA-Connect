import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventVolunteersSection } from "./EventVolunteersSection";

vi.mock("../lib/events-api", () => ({
  fetchEventVolunteerSignups: vi.fn(),
}));

import { fetchEventVolunteerSignups } from "../lib/events-api";

const mockedFetch = vi.mocked(fetchEventVolunteerSignups);

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

  it("shows assign-as-task action when enabled", async () => {
    const onConvertToTask = vi.fn();
    mockedFetch.mockResolvedValue({
      total: 1,
      signups: [
        {
          id: 1,
          member_id: 6,
          full_name: "apsana",
          note: "i can help with the decoration.",
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
        note: "i can help with the decoration.",
      }),
    );
  });
});
