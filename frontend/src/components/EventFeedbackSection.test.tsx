import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/events-api", () => ({
  fetchEventFeedback: vi.fn(),
}));

import { fetchEventFeedback } from "../lib/events-api";
import { EventFeedbackSection } from "./EventFeedbackSection";

const mockedFetch = vi.mocked(fetchEventFeedback);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EventFeedbackSection", () => {
  it("shows average rating and member feedback for board", async () => {
    mockedFetch.mockResolvedValue({
      total: 2,
      average_rating: 4.5,
      feedback: [
        {
          id: 1,
          member_id: 6,
          full_name: "apsana",
          rating: 5,
          comment: "Loved the decorations.",
          created_at: "2026-03-18T12:00:00Z",
        },
        {
          id: 2,
          member_id: 7,
          full_name: "Board Member",
          rating: 4,
          comment: null,
          created_at: "2026-03-19T12:00:00Z",
        },
      ],
    });

    render(
      <MemoryRouter>
        <EventFeedbackSection eventId={10} eventName="tihar" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("4.5 average from 2 responses")).toBeInTheDocument();
    expect(screen.getByText("apsana")).toBeInTheDocument();
    expect(screen.getByText("Loved the decorations.")).toBeInTheDocument();
    expect(screen.getByText("Board Member")).toBeInTheDocument();
  });

  it("shows empty state when no feedback exists", async () => {
    mockedFetch.mockResolvedValue({
      total: 0,
      average_rating: 0,
      feedback: [],
    });

    render(
      <MemoryRouter>
        <EventFeedbackSection eventId={10} eventName="tihar" />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("No feedback submitted yet.")).toBeInTheDocument(),
    );
  });
});
