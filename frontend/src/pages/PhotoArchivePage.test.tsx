import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhotoArchivePage } from "./PhotoArchivePage";

vi.mock("../lib/photo-archive-api", () => ({
  fetchPhotoAlbums: vi.fn(),
  createMediaAlbum: vi.fn(),
  downloadEventPhotoAlbum: vi.fn(),
  downloadCustomMediaAlbum: vi.fn(),
  triggerBrowserDownload: vi.fn(),
  LARGE_ALBUM_PHOTO_THRESHOLD: 50,
  ALBUM_DOWNLOAD_TIMEOUT_MS: 120_000,
}));

import {
  createMediaAlbum,
  fetchPhotoAlbums,
} from "../lib/photo-archive-api";

const mockedFetchPhotoAlbums = vi.mocked(fetchPhotoAlbums);
const mockedCreateMediaAlbum = vi.mocked(createMediaAlbum);

describe("PhotoArchivePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders albums as a dense media directory", async () => {
    mockedFetchPhotoAlbums.mockResolvedValue({
      total: 2,
      albums: [
        {
          kind: "event",
          id: 5,
          title: "Dashain Celebration",
          starts_at: "2020-06-01T18:00:00+00:00",
          event_type: "cultural",
          photo_count: 2,
          video_count: 1,
          cover_thumbnail_url: "https://example.com/thumb.jpg",
        },
        {
          kind: "event",
          id: 6,
          title: "WT Meeting 5",
          starts_at: "2020-07-22T18:00:00+00:00",
          event_type: "meeting",
          photo_count: 0,
          video_count: 0,
          cover_thumbnail_url: null,
        },
      ],
    });

    render(
      <MemoryRouter>
        <PhotoArchivePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Dashain Celebration")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Media" })).toBeInTheDocument();
    expect(
      screen.getByText(/Browse, upload, and organize photos and videos/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dashain Celebration/i })).toHaveAttribute(
      "href",
      "/events/media/5",
    );
    expect(screen.getByText(/2 photos/)).toBeInTheDocument();
    expect(screen.getByText(/1 video/)).toBeInTheDocument();
    expect(screen.getByText("Add media →")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /WT Meeting 5/i }),
    ).toHaveAttribute("href", "/events/media/6?upload=1");
    expect(
      screen.getByRole("button", { name: /Upload Media/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /New Album/i }),
    ).toBeInTheDocument();

    const summary = screen.getByLabelText("Media summary");
    expect(summary).toHaveTextContent("Albums");
    expect(summary).toHaveTextContent("Items");
  });

  it("links custom albums to the custom album route", async () => {
    mockedFetchPhotoAlbums.mockResolvedValue({
      total: 1,
      albums: [
        {
          kind: "custom",
          id: 42,
          title: "Picnic snaps",
          starts_at: null,
          event_type: null,
          photo_count: 3,
          video_count: 0,
          cover_thumbnail_url: null,
        },
      ],
    });

    render(
      <MemoryRouter>
        <PhotoArchivePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Picnic snaps")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Picnic snaps/i })).toHaveAttribute(
      "href",
      "/events/media/album/42",
    );
    expect(screen.getByText("Album")).toBeInTheDocument();
  });

  it("lets upload media pick event and custom albums", async () => {
    const user = userEvent.setup();
    mockedFetchPhotoAlbums.mockResolvedValue({
      total: 2,
      albums: [
        {
          kind: "event",
          id: 5,
          title: "Dashain Celebration",
          starts_at: "2020-06-01T18:00:00+00:00",
          event_type: "cultural",
          photo_count: 2,
          video_count: 0,
          cover_thumbnail_url: "https://example.com/thumb.jpg",
        },
        {
          kind: "custom",
          id: 9,
          title: "Board retreat",
          starts_at: null,
          event_type: null,
          photo_count: 0,
          video_count: 0,
          cover_thumbnail_url: null,
        },
      ],
    });

    render(
      <MemoryRouter>
        <PhotoArchivePage />
      </MemoryRouter>,
    );

    await screen.findByText("Dashain Celebration");
    await user.click(screen.getByRole("button", { name: /Upload Media/i }));
    expect(
      screen.getByRole("menu", { name: /Choose album to upload/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Board retreat/i }),
    ).toBeInTheDocument();
  });

  it("creates a new album and navigates to upload", async () => {
    const user = userEvent.setup();
    mockedFetchPhotoAlbums.mockResolvedValue({ total: 0, albums: [] });
    mockedCreateMediaAlbum.mockResolvedValue({
      kind: "custom",
      id: 77,
      title: "Spring photos",
      starts_at: null,
      event_type: null,
      photo_count: 0,
      video_count: 0,
      cover_thumbnail_url: null,
    });

    render(
      <MemoryRouter initialEntries={["/events/media"]}>
        <Routes>
          <Route path="/events/media" element={<PhotoArchivePage />} />
          <Route
            path="/events/media/album/:albumId"
            element={<div>Custom album page</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("No albums yet");
    await user.click(screen.getByRole("button", { name: /New Album/i }));
    await user.type(screen.getByPlaceholderText(/Summer picnic/i), "Spring photos");
    await user.click(screen.getByRole("button", { name: /Create album/i }));

    await waitFor(() =>
      expect(mockedCreateMediaAlbum).toHaveBeenCalledWith("Spring photos"),
    );
    expect(await screen.findByText("Custom album page")).toBeInTheDocument();
  });

  it("shows an empty state when there are no albums", async () => {
    mockedFetchPhotoAlbums.mockResolvedValue({ total: 0, albums: [] });

    render(
      <MemoryRouter>
        <PhotoArchivePage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("No albums yet")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /New Album/i }),
    ).toBeInTheDocument();
  });
});
