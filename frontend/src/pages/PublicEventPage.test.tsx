import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAuthProvider } from "../test/test-utils";
import { PublicEventPage } from "./PublicEventPage";

vi.mock("../lib/public-events-api", () => ({
  fetchPublicEvent: vi.fn(),
}));

import { fetchPublicEvent } from "../lib/public-events-api";

const mockedFetchPublicEvent = vi.mocked(fetchPublicEvent);

function renderPage() {
  return render(
    <MockAuthProvider
      value={{
        member: null,
        isAuthenticated: false,
      }}
    >
      <MemoryRouter initialEntries={["/e/12"]}>
        <Routes>
          <Route path="/e/:eventId" element={<PublicEventPage />} />
        </Routes>
      </MemoryRouter>
    </MockAuthProvider>,
  );
}

describe("PublicEventPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a public event landing page for guests", async () => {
    mockedFetchPublicEvent.mockResolvedValue({
      id: 12,
      name: "Dashain Night",
      starts_at: "2030-10-01T18:00:00+00:00",
      ends_at: null,
      event_type: "cultural",
      description: "Food and performances.",
      location: "University Center",
      event_photo_url: null,
      is_past: false,
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Dashain Night" }),
    ).toBeInTheDocument();
    expect(screen.getByText("University Center")).toBeInTheDocument();
    expect(screen.getByText("Food and performances.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in to RSVP" })).toHaveAttribute(
      "href",
      "/login?next=%2Fevents%2F12",
    );
  });

  it("shows unavailable state when the public API returns not found", async () => {
    mockedFetchPublicEvent.mockRejectedValue({
      response: { data: { detail: "Event not found" } },
      message: "Request failed",
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Event unavailable" }),
      ).toBeInTheDocument();
    });
  });
});
