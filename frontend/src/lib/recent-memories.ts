import type { MediaItem, PhotoAlbumSummary } from "./photo-archive-api";
import {
  fetchCustomMediaAlbum,
  fetchEventPhotos,
  fetchPhotoAlbums,
} from "./photo-archive-api";

export type RecentMemoriesPreview = {
  album: PhotoAlbumSummary;
  photos: MediaItem[];
  extraPhotoCount: number;
};

export function pickRecentMemoriesAlbum(
  albums: PhotoAlbumSummary[],
): PhotoAlbumSummary | null {
  return (
    albums.find((album) => album.kind === "event" && album.photo_count > 0) ??
    albums.find((album) => album.photo_count > 0) ??
    null
  );
}

export function buildRecentMemoriesPreview(
  album: PhotoAlbumSummary,
  photos: MediaItem[],
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

  const photos =
    album.kind === "custom"
      ? (await fetchCustomMediaAlbum(album.id)).items
      : (await fetchEventPhotos(album.id)).photos;

  if (photos.length === 0) {
    return null;
  }

  return buildRecentMemoriesPreview(album, photos);
}
