import { useState } from "react";
import { Trash2 } from "lucide-react";

import type { EventPhoto } from "../../lib/photo-archive-api";

type EventPhotoGridProps = {
  photos: EventPhoto[];
  onOpenPhoto: (index: number) => void;
  onDeletePhoto: (photo: EventPhoto) => void;
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
      {photos.map((photo, index) => (
        <li key={photo.id} className="group relative">
          <button
            type="button"
            className="block w-full overflow-hidden rounded-kanban border border-kanban-border bg-white"
            onClick={() => onOpenPhoto(index)}
            onMouseEnter={() => setHoveredId(photo.id)}
            onMouseLeave={() => setHoveredId(null)}
            onFocus={() => setHoveredId(photo.id)}
            onBlur={() => setHoveredId(null)}
          >
            <img
              src={photo.thumbnail_url}
              alt={`Photo by ${photo.uploaded_by_name}`}
              className="aspect-square w-full object-cover"
              loading="lazy"
            />
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
              aria-label={`Delete photo by ${photo.uploaded_by_name}`}
              disabled={deletingPhotoId === photo.id}
              onClick={() => onDeletePhoto(photo)}
              className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-label opacity-0 shadow-sm transition hover:text-foreground group-hover:opacity-100 focus:opacity-100"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
