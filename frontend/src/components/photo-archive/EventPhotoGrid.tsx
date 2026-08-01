import { Play, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  formatMediaDuration,
  type MediaItem,
} from "../../lib/photo-archive-api";
import { AppIcon } from "../ui/AppIcon";

type EventPhotoGridProps = {
  photos: MediaItem[];
  onOpenPhoto: (index: number) => void;
  onDeletePhoto: (photo: MediaItem) => void;
  deletingPhotoId?: number | null;
};

export function EventPhotoGrid({
  photos,
  onOpenPhoto,
  onDeletePhoto,
  deletingPhotoId = null,
}: EventPhotoGridProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {photos.map((photo, index) => {
        const isVideo = photo.media_kind === "video";
        const duration = formatMediaDuration(photo.duration_seconds);

        return (
          <li key={photo.id} className="group relative">
            <button
              type="button"
              className="relative block w-full overflow-hidden rounded-kanban border border-kanban-border bg-white"
              onClick={() => onOpenPhoto(index)}
              onMouseEnter={() => setHoveredId(photo.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(photo.id)}
              onBlur={() => setHoveredId(null)}
            >
              {isVideo ? (
                <video
                  src={photo.image_url}
                  poster={photo.thumbnail_url}
                  className="aspect-square w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={photo.thumbnail_url}
                  alt={`Media by ${photo.uploaded_by_name}`}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              )}

              {isVideo ? (
                <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[0.6875rem] font-medium text-white">
                  <AppIcon icon={Play} size="xs" className="text-current" />
                  {duration || "Video"}
                </span>
              ) : null}

              <span
                className={[
                  "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-3 text-left text-xs text-white transition-opacity",
                  hoveredId === photo.id ? "opacity-100" : "opacity-0",
                ].join(" ")}
              >
                {photo.uploaded_by_name}
              </span>
            </button>

            {photo.can_delete ? (
              <button
                type="button"
                aria-label={`Delete media by ${photo.uploaded_by_name}`}
                disabled={deletingPhotoId === photo.id}
                onClick={() => onDeletePhoto(photo)}
                className="absolute right-2 top-2 ds-icon-btn rounded-full bg-white/90 p-1.5 text-label opacity-0 shadow-sm transition hover:text-foreground group-hover:opacity-100 focus:opacity-100"
              >
                <AppIcon icon={Trash2} size="sm" className="text-current" />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
