import { Link } from "react-router-dom";

import { ArrowLink } from "./ui/ArrowLink";
import { HomeCard } from "./ui/HomeCard";
import { photoAlbumPath, photoArchivePath } from "../lib/event-links";
import type { RecentMemoriesPreview } from "../lib/recent-memories";

type RecentMemoriesStripProps = {
  memories: RecentMemoriesPreview;
};

function formatPhotoCount(count: number): string {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

export function RecentMemoriesStrip({ memories }: RecentMemoriesStripProps) {
  const { album, photos, extraPhotoCount } = memories;

  return (
    <HomeCard padding="sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-foreground">Recent memories</h2>
          <p className="mt-1 text-sm text-label">
            From {album.event_name} · {formatPhotoCount(album.photo_count)}
          </p>
        </div>
        <ArrowLink to={photoArchivePath()}>View all photos</ArrowLink>
      </div>

      <ul className="mt-4 grid grid-cols-4 gap-2">
        {photos.map((photo, index) => {
          const isLastWithMore =
            index === photos.length - 1 && extraPhotoCount > 0;

          return (
            <li key={photo.id}>
              <Link
                to={photoAlbumPath(album.event_id)}
                className="group relative block aspect-square overflow-hidden rounded-[10px] bg-surface-muted"
                aria-label={
                  isLastWithMore
                    ? `View ${album.event_name} album, ${extraPhotoCount} more photos`
                    : `View photo from ${album.event_name}`
                }
              >
                <img
                  src={photo.thumbnail_url}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                {isLastWithMore ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-medium text-white">
                    +{extraPhotoCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </HomeCard>
  );
}
