import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import type { EventPhoto } from "../../lib/photo-archive-api";

type PhotoLightboxProps = {
  photos: EventPhoto[];
  activeIndex: number;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
};

export function PhotoLightbox({
  photos,
  activeIndex,
  onClose,
  onChangeIndex,
}: PhotoLightboxProps) {
  const photo = photos[activeIndex];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowRight") {
        onChangeIndex(Math.min(activeIndex + 1, photos.length - 1));
      }
      if (event.key === "ArrowLeft") {
        onChangeIndex(Math.max(activeIndex - 1, 0));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, onChangeIndex, onClose, photos.length]);

  if (!photo) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${activeIndex + 1} of ${photos.length}`}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label="Close lightbox"
        onClick={onClose}
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {activeIndex > 0 ? (
        <button
          type="button"
          className="absolute left-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          aria-label="Previous photo"
          onClick={(event) => {
            event.stopPropagation();
            onChangeIndex(activeIndex - 1);
          }}
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>
      ) : null}

      {activeIndex < photos.length - 1 ? (
        <button
          type="button"
          className="absolute right-4 top-16 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          aria-label="Next photo"
          onClick={(event) => {
            event.stopPropagation();
            onChangeIndex(activeIndex + 1);
          }}
        >
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </button>
      ) : null}

      <figure
        className="max-h-[90vh] max-w-[90vw]"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={photo.image_url}
          alt={`Photo by ${photo.uploaded_by_name}`}
          className="max-h-[82vh] max-w-full rounded-card object-contain"
        />
        <figcaption className="mt-3 text-center text-sm text-white/90">
          {photo.uploaded_by_name} · {activeIndex + 1} of {photos.length}
        </figcaption>
      </figure>
    </div>
  );
}
