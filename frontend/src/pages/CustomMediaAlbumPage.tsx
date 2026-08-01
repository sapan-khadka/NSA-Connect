import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import { PageHeader } from "../components/PageHeader";
import { DownloadAlbumButton } from "../components/photo-archive/DownloadAlbumButton";
import { EventPhotoGrid } from "../components/photo-archive/EventPhotoGrid";
import { PhotoLightbox } from "../components/photo-archive/PhotoLightbox";
import { PhotoUploadPanel } from "../components/photo-archive/PhotoUploadPanel";
import { ArrowLink } from "../components/ui/ArrowLink";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { getApiErrorMessage } from "../lib/api-error";
import { photoArchivePath } from "../lib/event-links";
import {
  deleteMediaAlbum,
  deleteMediaAlbumItem,
  fetchCustomMediaAlbum,
  renameMediaAlbum,
  type MediaItem,
  type MediaKind,
} from "../lib/photo-archive-api";

type MediaFilter = "all" | MediaKind;

export function CustomMediaAlbumPage() {
  const { albumId: albumIdParam } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const albumId = Number(albumIdParam);
  const [title, setTitle] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [manageBusy, setManageBusy] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);

  const loadAlbum = useCallback(async () => {
    if (!Number.isFinite(albumId)) {
      setError("Invalid album.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchCustomMediaAlbum(albumId);
      setTitle(response.title);
      setCanManage(response.can_manage);
      setItems(response.items);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    void loadAlbum();
  }, [loadAlbum]);

  useEffect(() => {
    if (isLoading || searchParams.get("upload") !== "1") {
      return;
    }
    const panel = document.getElementById("photo-upload");
    panel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isLoading, searchParams]);

  const photoCount = useMemo(
    () => items.filter((item) => item.media_kind !== "video").length,
    [items],
  );
  const videoCount = useMemo(
    () => items.filter((item) => item.media_kind === "video").length,
    [items],
  );

  const filtered = useMemo(() => {
    if (filter === "all") {
      return items;
    }
    return items.filter((item) => item.media_kind === filter);
  }, [filter, items]);

  function handleUploaded(item: MediaItem) {
    setItems((current) => [...current, item]);
  }

  async function handleDeleteItem(item: MediaItem) {
    setDeletingItemId(item.id);
    try {
      await deleteMediaAlbumItem(albumId, item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setActiveIndex((current) => {
        if (current === null) {
          return null;
        }
        const deletedIndex = filtered.findIndex((entry) => entry.id === item.id);
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
      setDeletingItemId(null);
    }
  }

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    const cleaned = renameTitle.trim();
    if (!cleaned) {
      setManageError("Enter an album title.");
      return;
    }
    setManageBusy(true);
    setManageError(null);
    try {
      const updated = await renameMediaAlbum(albumId, cleaned);
      setTitle(updated.title);
      setRenameOpen(false);
    } catch (caught) {
      setManageError(getApiErrorMessage(caught));
    } finally {
      setManageBusy(false);
    }
  }

  async function handleDeleteAlbum() {
    const confirmed = window.confirm(
      "Delete this album and all of its media? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }
    setManageBusy(true);
    setManageError(null);
    try {
      await deleteMediaAlbum(albumId);
      void navigate(photoArchivePath());
    } catch (caught) {
      setManageError(getApiErrorMessage(caught));
      setManageBusy(false);
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
        <Link
          to={photoArchivePath()}
          className="text-sm text-accent hover:text-accent-hover"
        >
          ← Media
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Album"
          title={title || "Album"}
          description="Upload and browse photos and videos in this album."
        />
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={manageBusy}
              onClick={() => {
                setRenameTitle(title);
                setManageError(null);
                setRenameOpen(true);
              }}
            >
              Rename
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={manageBusy}
              onClick={() => void handleDeleteAlbum()}
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {manageError && !renameOpen ? (
        <div role="alert" className="ds-alert-banner">
          {manageError}
        </div>
      ) : null}

      <PhotoUploadPanel
        albumId={albumId}
        albumKind="custom"
        onUploaded={handleUploaded}
      />

      {isLoading ? <p className="text-sm text-label">Loading media…</p> : null}

      {error ? (
        <div role="alert" className="ds-alert-banner">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No media yet"
          description="Be the first to add photos or videos to this album."
        />
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-label">{countLabel}</p>
            <div className="flex flex-wrap items-center gap-3">
              <DownloadAlbumButton
                albumId={albumId}
                albumKind="custom"
                photoCount={items.length}
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
              onDeletePhoto={(item) => void handleDeleteItem(item)}
              deletingPhotoId={deletingItemId}
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

      <Modal
        open={renameOpen}
        title="Rename album"
        onClose={() => {
          if (!manageBusy) {
            setRenameOpen(false);
            setManageError(null);
          }
        }}
        size="md"
      >
        <form className="space-y-4" onSubmit={(event) => void handleRename(event)}>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Title</span>
            <input
              type="text"
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.target.value)}
              maxLength={255}
              autoFocus
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          {manageError ? (
            <p role="alert" className="text-sm text-urgent">
              {manageError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={manageBusy}
              onClick={() => {
                setRenameOpen(false);
                setManageError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={manageBusy} disabled={manageBusy}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
