import { ImageIcon, Plus, Search } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import { PhotoAlbumGrid } from "../components/photo-archive/PhotoAlbumGrid";
import { AppIcon } from "../components/ui/AppIcon";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { getApiErrorMessage } from "../lib/api-error";
import { customMediaAlbumPath, mediaAlbumHref } from "../lib/event-links";
import {
  createMediaAlbum,
  fetchPhotoAlbums,
  type PhotoAlbumSummary,
} from "../lib/photo-archive-api";

function albumMediaTotal(album: PhotoAlbumSummary): number {
  return (album.photo_count ?? 0) + (album.video_count ?? 0);
}

function UploadPhotosControl({ albums }: { albums: PhotoAlbumSummary[] }) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...albums].sort((left, right) => {
      const leftEmpty = albumMediaTotal(left) === 0;
      const rightEmpty = albumMediaTotal(right) === 0;
      if (leftEmpty !== rightEmpty) {
        return leftEmpty ? -1 : 1;
      }
      const leftDate = left.starts_at ? Date.parse(left.starts_at) : 0;
      const rightDate = right.starts_at ? Date.parse(right.starts_at) : 0;
      return rightDate - leftDate;
    });
    if (!needle) {
      return sorted;
    }
    return sorted.filter((album) => album.title.toLowerCase().includes(needle));
  }, [albums, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: globalThis.MouseEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (albums.length === 0) {
    return null;
  }

  if (albums.length === 1) {
    return (
      <Link
        to={`${mediaAlbumHref(albums[0])}?upload=1`}
        className="photo-archive-cta"
      >
        <AppIcon icon={Plus} size="xs" className="text-current" />
        Upload Media
      </Link>
    );
  }

  return (
    <div className="photo-archive-upload" ref={rootRef}>
      <button
        type="button"
        className="photo-archive-cta"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <AppIcon icon={Plus} size="xs" className="text-current" />
        Upload Media
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="photo-archive-upload__menu"
          aria-label="Choose album to upload"
        >
          <label className="photo-archive-upload__search">
            <AppIcon
              icon={Search}
              size="sm"
              className="photo-archive-upload__search-icon"
            />
            <span className="sr-only">Filter albums</span>
            <input
              type="search"
              value={query}
              placeholder="Choose an album…"
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </label>
          <div className="photo-archive-upload__list">
            {options.length === 0 ? (
              <p className="photo-archive-upload__empty">No matching albums</p>
            ) : (
              options.map((album) => (
                <button
                  key={`${album.kind}-${album.id}`}
                  type="button"
                  role="menuitem"
                  className="photo-archive-upload__item"
                  onClick={() => {
                    setOpen(false);
                    void navigate(`${mediaAlbumHref(album)}?upload=1`);
                  }}
                >
                  <span className="photo-archive-upload__item-name">
                    {album.title}
                  </span>
                  <span className="photo-archive-upload__item-meta">
                    {albumMediaTotal(album) === 0
                      ? "Empty"
                      : `${albumMediaTotal(album)} items`}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ArchiveSummary({ albums }: { albums: PhotoAlbumSummary[] }) {
  const albumCount = albums.length;
  const mediaCount = albums.reduce(
    (sum, album) => sum + albumMediaTotal(album),
    0,
  );

  return (
    <div className="photo-archive-summary" aria-label="Media summary">
      <div className="photo-archive-summary__cell">
        <p className="photo-archive-summary__value">{albumCount}</p>
        <p className="photo-archive-summary__label">Albums</p>
      </div>
      <div className="photo-archive-summary__cell">
        <p className="photo-archive-summary__value">{mediaCount}</p>
        <p className="photo-archive-summary__label">Items</p>
      </div>
    </div>
  );
}

function NewAlbumControl({
  onCreated,
}: {
  onCreated: (album: PhotoAlbumSummary) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) {
      return;
    }
    setOpen(false);
    setTitle("");
    setError(null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const cleaned = title.trim();
    if (!cleaned) {
      setError("Enter an album title.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const album = await createMediaAlbum(cleaned);
      onCreated(album);
      setOpen(false);
      setTitle("");
      void navigate(`${customMediaAlbumPath(album.id)}?upload=1`);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="photo-archive-cta photo-archive-cta--primary"
        onClick={() => setOpen(true)}
      >
        <AppIcon icon={Plus} size="xs" className="text-current" />
        New Album
      </button>
      <Modal open={open} title="New album" onClose={close} size="md">
        <form className="space-y-4" onSubmit={(event) => void handleCreate(event)}>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
              autoFocus
              placeholder="e.g. Summer picnic"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-urgent">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={busy}>
              Create album
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

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
    <div className="photo-archive">
      <header className="photo-archive-header">
        <div className="photo-archive-heading">
          <div className="photo-archive-title-row">
            <h1 className="photo-archive-title">Media</h1>
            {!isLoading && !error ? (
              <div className="photo-archive-header-actions">
                <NewAlbumControl
                  onCreated={(album) =>
                    setAlbums((current) => [album, ...current])
                  }
                />
                <UploadPhotosControl albums={albums} />
              </div>
            ) : null}
          </div>
          <p className="photo-archive-subtitle">
            Browse, upload, and organize photos and videos from events and
            custom albums.
          </p>
        </div>
      </header>

      {isLoading ? (
        <p className="photo-archive-status">Loading albums…</p>
      ) : null}

      {error ? (
        <div role="alert" className="ds-alert-banner">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && albums.length === 0 ? (
        <div className="photo-archive-empty-state">
          <div className="photo-archive-empty-state__icon" aria-hidden="true">
            <AppIcon icon={ImageIcon} size="md" className="text-current" />
          </div>
          <p className="photo-archive-empty-state__title">No albums yet</p>
          <p className="photo-archive-empty-state__copy">
            Create a custom album with New Album, or enable “Show in Media” on an
            event’s manage page.
          </p>
        </div>
      ) : null}

      {!isLoading && !error && albums.length > 0 ? (
        <>
          <ArchiveSummary albums={albums} />
          <PhotoAlbumGrid albums={albums} />
        </>
      ) : null}
    </div>
  );
}
