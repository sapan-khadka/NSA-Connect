import { describe, expect, it } from "vitest";

import {
  buildRecentMemoriesPreview,
  pickRecentMemoriesAlbum,
} from "./recent-memories";
import type { MediaItem, PhotoAlbumSummary } from "./photo-archive-api";

const album: PhotoAlbumSummary = {
  kind: "event",
  id: 7,
  title: "Dashain",
  starts_at: "2026-10-01T18:00:00Z",
  event_type: "cultural",
  photo_count: 16,
  video_count: 0,
  cover_thumbnail_url: "https://example.com/cover.jpg",
};

function makePhoto(id: number): MediaItem {
  return {
    id,
    uploaded_by_id: 1,
    uploaded_by_name: "Member",
    image_url: `https://example.com/${id}.jpg`,
    thumbnail_url: `https://example.com/${id}-thumb.jpg`,
    created_at: "2026-10-02T12:00:00Z",
    can_delete: false,
    media_kind: "photo",
    duration_seconds: null,
  };
}

describe("recent-memories", () => {
  it("picks the first event album that already has photos", () => {
    const albums: PhotoAlbumSummary[] = [
      { ...album, id: 1, photo_count: 0 },
      { ...album, id: 2, photo_count: 3 },
      { ...album, id: 3, photo_count: 8 },
    ];

    expect(pickRecentMemoriesAlbum(albums)?.id).toBe(2);
  });

  it("prefers event albums over custom albums", () => {
    const albums: PhotoAlbumSummary[] = [
      {
        kind: "custom",
        id: 99,
        title: "Custom",
        starts_at: null,
        event_type: null,
        photo_count: 5,
        video_count: 0,
        cover_thumbnail_url: null,
      },
      { ...album, id: 2, photo_count: 3 },
    ];

    expect(pickRecentMemoriesAlbum(albums)?.id).toBe(2);
  });

  it("builds a four-photo preview with an overflow count", () => {
    const photos = Array.from({ length: 16 }, (_, index) => makePhoto(index + 1));
    const preview = buildRecentMemoriesPreview(album, photos);

    expect(preview.photos).toHaveLength(4);
    expect(preview.photos.map((photo) => photo.id)).toEqual([13, 14, 15, 16]);
    expect(preview.extraPhotoCount).toBe(12);
  });

  it("omits overflow when the album has four or fewer photos", () => {
    const preview = buildRecentMemoriesPreview(
      { ...album, photo_count: 3 },
      [makePhoto(1), makePhoto(2), makePhoto(3)],
    );

    expect(preview.photos).toHaveLength(3);
    expect(preview.extraPhotoCount).toBe(0);
  });
});
