import { useEffect, useState } from "react";

import { PageHeader } from "../components/PageHeader";
import { PhotoAlbumGrid } from "../components/photo-archive/PhotoAlbumGrid";
import { EmptyState } from "../components/ui/EmptyState";
import { getApiErrorMessage } from "../lib/api-error";
import { fetchPhotoAlbums, type PhotoAlbumSummary } from "../lib/photo-archive-api";

export function PhotoArchivePage() {
  const [albums, setAlbums] = useState<PhotoAlbumSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchPhotoAlbums();
        if (!cancelled) {
          setAlbums(response.albums);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(getApiErrorMessage(caught));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Events"
        title="Photo archive"
        description="Browse event photo albums. Open an album to view, upload, and share memories."
      />

      {isLoading ? (
        <p className="text-sm text-label">Loading albums…</p>
      ) : null}

      {error ? (
        <div role="alert" className="ds-alert-banner">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && albums.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No event albums yet"
          description="Events appear here when board members enable “Show in photo archive” on the manage page."
        />
      ) : null}

      {!isLoading && !error && albums.length > 0 ? (
        <PhotoAlbumGrid albums={albums} />
      ) : null}
    </div>
  );
}
