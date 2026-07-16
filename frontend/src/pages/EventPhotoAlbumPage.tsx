import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { EventPhotoGrid } from "../components/photo-archive/EventPhotoGrid";
import { DownloadAlbumButton } from "../components/photo-archive/DownloadAlbumButton";
import { PhotoLightbox } from "../components/photo-archive/PhotoLightbox";
import { PhotoUploadPanel } from "../components/photo-archive/PhotoUploadPanel";
import { ArrowLink } from "../components/ui/ArrowLink";
import { EmptyState } from "../components/ui/EmptyState";
import { getApiErrorMessage } from "../lib/auth-api";
import { photoArchivePath } from "../lib/event-links";
import type { CalendarReturnState } from "../lib/event-manage-navigation";
import {
  deleteEventPhoto,
  fetchEventPhotos,
  type EventPhoto,
} from "../lib/photo-archive-api";

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

  function handleUploaded(photo: EventPhoto) {
    setPhotos((current) => [...current, photo]);
  }

  async function handleDeletePhoto(photo: EventPhoto) {
    setDeletingPhotoId(photo.id);
    try {
      await deleteEventPhoto(eventId, photo.id);
      setPhotos((current) => current.filter((entry) => entry.id !== photo.id));
      setActiveIndex((current) => {
        if (current === null) {
          return null;
        }
        const deletedIndex = photos.findIndex((entry) => entry.id === photo.id);
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

  return (
    <div className="space-y-6">
      <div>
        {calendarBackHref ? (
          <Link
            to={calendarBackHref}
            className="text-sm text-accent hover:text-accent-hover"
          >
            ← Back to {eventName.trim() || "calendar"}
          </Link>
        ) : (
          <Link
            to={photoArchivePath()}
            className="text-sm text-accent hover:text-accent-hover"
          >
            ← Photo archive
          </Link>
        )}
      </div>

      <PageHeader
        eyebrow="Event album"
        title={eventName || "Event photos"}
        description="Upload and browse photos from this event."
      />

      <PhotoUploadPanel eventId={eventId} onUploaded={handleUploaded} />

      {isLoading ? <p className="text-sm text-label">Loading photos…</p> : null}

      {error ? (
        <div role="alert" className="ds-alert-banner">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && photos.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No photos yet"
          description="Be the first to add photos from this event."
        />
      ) : null}

      {!isLoading && !error && photos.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-label">
              {photos.length} {photos.length === 1 ? "photo" : "photos"}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <DownloadAlbumButton eventId={eventId} photoCount={photos.length} />
              <ArrowLink to={photoArchivePath()}>All albums</ArrowLink>
            </div>
          </div>
          <EventPhotoGrid
            photos={photos}
            onOpenPhoto={setActiveIndex}
            onDeletePhoto={(photo) => void handleDeletePhoto(photo)}
            deletingPhotoId={deletingPhotoId}
          />
        </section>
      ) : null}

      {activeIndex !== null ? (
        <PhotoLightbox
          photos={photos}
          activeIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
          onChangeIndex={setActiveIndex}
        />
      ) : null}
    </div>
  );
}
