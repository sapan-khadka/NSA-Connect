import { ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { EVENT_TYPE_LABELS } from "../../lib/event-types";
import { formatEventDateTime } from "../../lib/format-datetime";
import { photoAlbumPath } from "../../lib/event-links";
import type { PhotoAlbumSummary } from "../../lib/photo-archive-api";

type PhotoAlbumGridProps = {
  albums: PhotoAlbumSummary[];
};

export function PhotoAlbumGrid({ albums }: PhotoAlbumGridProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {albums.map((album) => (
        <li key={album.event_id}>
          <Link
            to={photoAlbumPath(album.event_id)}
            className="group block overflow-hidden rounded-card border border-kanban-border bg-white transition hover:shadow-sm"
          >
            <div className="aspect-[4/3] overflow-hidden bg-surface-muted">
              {album.cover_thumbnail_url ? (
                <img
                  src={album.cover_thumbnail_url}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-label">
                  <ImageIcon className="h-8 w-8" strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-xs">No photos yet</span>
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="line-clamp-2 text-sm text-foreground">{album.event_name}</p>
              <p className="mt-1 text-xs text-label">
                {formatEventDateTime(album.starts_at)}
              </p>
              <p className="mt-2 text-xs text-label">
                {EVENT_TYPE_LABELS[album.event_type]} · {album.photo_count}{" "}
                {album.photo_count === 1 ? "photo" : "photos"}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
