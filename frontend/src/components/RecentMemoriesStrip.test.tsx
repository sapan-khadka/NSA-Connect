import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { RecentMemoriesStrip } from "./RecentMemoriesStrip";
import type { RecentMemoriesPreview } from "../lib/recent-memories";

const memories: RecentMemoriesPreview = {
  album: {
    kind: "event",
    id: 7,
    title: "Dashain",
    starts_at: "2026-10-01T18:00:00Z",
    event_type: "cultural",
    photo_count: 16,
    video_count: 0,
    cover_thumbnail_url: "https://example.com/cover.jpg",
  },
  photos: [
    {
      id: 1,
      uploaded_by_id: 1,
      uploaded_by_name: "Member",
      image_url: "https://example.com/1.jpg",
      thumbnail_url: "https://example.com/1-thumb.jpg",
      created_at: "2026-10-02T12:00:00Z",
      can_delete: false,
      media_kind: "photo",
      duration_seconds: null,
    },
    {
      id: 2,
      uploaded_by_id: 1,
      uploaded_by_name: "Member",
      image_url: "https://example.com/2.jpg",
      thumbnail_url: "https://example.com/2-thumb.jpg",
      created_at: "2026-10-02T12:05:00Z",
      can_delete: false,
      media_kind: "photo",
      duration_seconds: null,
    },
    {
      id: 3,
      uploaded_by_id: 1,
      uploaded_by_name: "Member",
      image_url: "https://example.com/3.jpg",
      thumbnail_url: "https://example.com/3-thumb.jpg",
      created_at: "2026-10-02T12:10:00Z",
      can_delete: false,
      media_kind: "photo",
      duration_seconds: null,
    },
    {
      id: 4,
      uploaded_by_id: 1,
      uploaded_by_name: "Member",
      image_url: "https://example.com/4.jpg",
      thumbnail_url: "https://example.com/4-thumb.jpg",
      created_at: "2026-10-02T12:15:00Z",
      can_delete: false,
      media_kind: "photo",
      duration_seconds: null,
    },
  ],
  extraPhotoCount: 12,
};

describe("RecentMemoriesStrip", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the album summary, thumbnails, and media links", () => {
    render(
      <MemoryRouter>
        <RecentMemoriesStrip memories={memories} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Recent memories")).toBeInTheDocument();
    expect(screen.getByText("From Dashain · 16 photos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all media" })).toHaveAttribute(
      "href",
      "/events/media",
    );
    expect(screen.getByText("+12")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /View photo from Dashain/i })).toHaveLength(3);
    expect(
      screen.getByRole("link", {
        name: "View Dashain album, 12 more photos",
      }),
    ).toHaveAttribute("href", "/events/media/7");
  });
});
