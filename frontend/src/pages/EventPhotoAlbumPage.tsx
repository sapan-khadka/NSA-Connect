import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router";

import { PageHeader } from "../components/PageHeader";
import { EventPhotoGrid } from "../components/photo-archive/EventPhotoGrid";
import { DownloadAlbumButton } from "../components/photo-archive/DownloadAlbumButton";
import { PhotoLightbox } from "../components/photo-archive/PhotoLightbox";
import { PhotoUploadPanel } from "../components/photo-archive/PhotoUploadPanel";
import { ArrowLink } from "../components/ui/ArrowLink";
import { EmptyState } from "../components/ui/EmptyState";
import { PageBackLink } from "../components/ui/PageBackLink";
import { getApiErrorMessage } from "../lib/api-error";
import { photoArchivePath } from "../lib/event-links";
import type { CalendarReturnState } from "../lib/event-manage-navigation";
import {
  deleteEventPhoto,
  fetchEventPhotos,
  type EventPhoto,
  type MediaItem,
  type MediaKind,
} from "../lib/photo-archive-api";

type MediaFilter = "all" | MediaKind;

function calendarReturnHref(
  state: CalendarReturnState | null | undefined,
): string | null {
  if (
    !state?.fromCalendar ||
    !state.calendarDate ||
    !Number.isFinite(state.calendarEventId)
  ) {
    return null;
  }
  return `/events/calendar?date=${encodeURIComponent(state.calendarDate)}&event=${state.calendarEventId}`;
}

export function EventPhotoAlbumPage() {
  const { eventId: eventIdParam } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const eventId = Number(eventIdParam);
  const calendarBackHref = calendarReturnHref(
    location.state as CalendarReturnState | null,
  );
  const [eventName, setEventName] = useState("");
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
  const [filter, setFilter] = useState<MediaFilter>("all");

  const loadPhotos = useCallback(async () => {
    if (!Number.isFinite(eventId)) {
      setError("Invalid event.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchEventPhotos(eventId);
      setEventName(response.event_name);
      setPhotos(response.photos);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    if (isLoading || searchParams.get("upload") !== "1") {
      return;
    }
    const panel = document.getElementById("photo-upload");
    panel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isLoading, searchParams]);

  const photoCount = useMemo(
    () => photos.filter((item) => item.media_kind !== "video").length,
    [photos],
  );
  const videoCount = useMemo(
    () => photos.filter((item) => item.media_kind === "video").length,
    [photos],
  );

  const filtered = useMemo(() => {
    if (filter === "all") {
      return photos;
    }
    return photos.filter((item) => item.media_kind === filter);
  }, [filter, photos]);

  function handleUploaded(item: MediaItem) {
    setPhotos((current) => [...current, { ...item, event_id: eventId }]);
  }

  async function handleDeletePhoto(photo: MediaItem) {
    setDeletingPhotoId(photo.id);
    try {
      await deleteEventPhoto(eventId, photo.id);
      setPhotos((current) => current.filter((entry) => entry.id !== photo.id));
      setActiveIndex((current) => {
        if (current === null) {
          return null;
        }
        const deletedIndex = filtered.findIndex((entry) => entry.id === photo.id);
        if (current === deletedIndex) {
          return null;
        }
        if (current > deletedIndex) {
          return current - 1;
        }
        return current;
      });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setDeletingPhotoId(null);
    }
  }

  const countLabel = [
    photoCount === 1 ? "1 photo" : `${photoCount} photos`,
    videoCount > 0
      ? videoCount === 1
        ? "1 video"
        : `${videoCount} videos`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <div>
        {calendarBackHref ? (
          <PageBackLink
            to={calendarBackHref}
            label={eventName.trim() || "calendar"}
          />
        ) : (
          <PageBackLink to={photoArchivePath()} label="Media" />
        )}
      </div>

      <PageHeader
        eyebrow="Event album"
        title={eventName || "Event media"}
        description="Upload and browse photos and videos from this event."
      />

      <PhotoUploadPanel
        albumId={eventId}
        albumKind="event"
        onUploaded={handleUploaded}
      />

      {isLoading ? <p className="text-sm text-label">Loading media…</p> : null}

      {error ? (
        <div role="alert" className="ds-alert-banner">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && photos.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No media yet"
          description="Be the first to add photos or videos from this event."
        />
      ) : null}

      {!isLoading && !error && photos.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-label">{countLabel}</p>
            <div className="flex flex-wrap items-center gap-3">
              <DownloadAlbumButton
                albumId={eventId}
                albumKind="event"
                photoCount={photos.length}
              />
              <ArrowLink to={photoArchivePath()}>All albums</ArrowLink>
            </div>
          </div>

          <div className="photo-archive-media-filters" role="tablist" aria-label="Media type">
            {(
              [
                ["all", "All"],
                ["photo", "Photos"],
                ["video", "Videos"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className={[
                  "photo-archive-media-filters__btn",
                  filter === value ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  setFilter(value);
                  setActiveIndex(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-label">No items in this filter.</p>
          ) : (
            <EventPhotoGrid
              photos={filtered}
              onOpenPhoto={setActiveIndex}
              onDeletePhoto={(photo) => void handleDeletePhoto(photo)}
              deletingPhotoId={deletingPhotoId}
            />
          )}
        </section>
      ) : null}

      {activeIndex !== null ? (
        <PhotoLightbox
          photos={filtered}
          activeIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
          onChangeIndex={setActiveIndex}
        />
      ) : null}
    </div>
  );
}
