import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhotoArchivePage } from "./PhotoArchivePage";

vi.mock("../lib/photo-archive-api", () => ({
  fetchPhotoAlbums: vi.fn(),
}));

import { fetchPhotoAlbums } from "../lib/photo-archive-api";

const mockedFetchPhotoAlbums = vi.mocked(fetchPhotoAlbums);

describe("PhotoArchivePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders past event albums", async () => {
    mockedFetchPhotoAlbums.mockResolvedValue({
      total: 1,
      albums: [
        {
          event_id: 5,
          event_name: "Dashain Celebration",
          starts_at: "2020-06-01T18:00:00+00:00",
          event_type: "cultural",
          photo_count: 2,
          cover_thumbnail_url: "https://example.com/thumb.jpg",
        },
      ],
    });

    render(
      <MemoryRouter>
        <PhotoArchivePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Dashain Celebration")).toBeInTheDocument();
    expect(screen.getByText(/2 photos/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dashain Celebration/i })).toHaveAttribute(
      "href",
      "/events/photos/5",
    );
  });

  it("shows an empty state when there are no albums", async () => {
    mockedFetchPhotoAlbums.mockResolvedValue({ total: 0, albums: [] });

    render(
      <MemoryRouter>
        <PhotoArchivePage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("No past event albums yet")).toBeInTheDocument(),
    );
  });
});
