import type { EventPhoto, PhotoAlbumSummary } from "./photo-archive-api";
import { fetchEventPhotos, fetchPhotoAlbums } from "./photo-archive-api";

export type RecentMemoriesPreview = {
  album: PhotoAlbumSummary;
  photos: EventPhoto[];
  extraPhotoCount: number;
};

export function pickRecentMemoriesAlbum(
  albums: PhotoAlbumSummary[],
): PhotoAlbumSummary | null {
  return albums.find((album) => album.photo_count > 0) ?? null;
}

export function buildRecentMemoriesPreview(
  album: PhotoAlbumSummary,
  photos: EventPhoto[],
): RecentMemoriesPreview {
  const previewPhotos = photos.slice(-4);

  return {
    album,
    photos: previewPhotos,
    extraPhotoCount: Math.max(0, album.photo_count - 4),
  };
}

export async function fetchRecentMemories(): Promise<RecentMemoriesPreview | null> {
  const { albums } = await fetchPhotoAlbums();
  const album = pickRecentMemoriesAlbum(albums);

  if (!album) {
    return null;
  }

  const response = await fetchEventPhotos(album.event_id);

  if (response.photos.length === 0) {
    return null;
  }

  return buildRecentMemoriesPreview(album, response.photos);
}
