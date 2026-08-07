import { MoreHorizontal, Search } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Link, useNavigate } from "react-router";

import { getApiErrorMessage } from "../../lib/api-error";
import { mediaAlbumHref } from "../../lib/event-links";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABELS } from "../../lib/event-types";
import {
  ALBUM_DOWNLOAD_TIMEOUT_MS,
  downloadCustomMediaAlbum,
  downloadEventPhotoAlbum,
  LARGE_ALBUM_PHOTO_THRESHOLD,
  triggerBrowserDownload,
  type PhotoAlbumSummary,
} from "../../lib/photo-archive-api";
import { AppIcon } from "../ui/AppIcon";

type PhotoAlbumGridProps = {
  albums: PhotoAlbumSummary[];
};

function formatAlbumDate(isoDate: string | null): string | null {
  if (!isoDate) {
    return null;
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function mediaMetaParts(album: PhotoAlbumSummary): string[] {
  const photoCount = album.photo_count ?? 0;
  const videoCount = album.video_count ?? 0;
  const parts: string[] = [];
  if (photoCount > 0 || videoCount === 0) {
    parts.push(photoCount === 1 ? "1 photo" : `${photoCount} photos`);
  }
  if (videoCount > 0) {
    parts.push(videoCount === 1 ? "1 video" : `${videoCount} videos`);
  }
  return parts;
}

function albumMediaTotal(album: PhotoAlbumSummary): number {
  return (album.photo_count ?? 0) + (album.video_count ?? 0);
}

function sortAlbums(albums: PhotoAlbumSummary[]): PhotoAlbumSummary[] {
  return [...albums].sort((left, right) => {
    const delta = albumMediaTotal(right) - albumMediaTotal(left);
    if (delta !== 0) {
      return delta;
    }
    const leftDate = left.starts_at ? Date.parse(left.starts_at) : 0;
    const rightDate = right.starts_at ? Date.parse(right.starts_at) : 0;
    return rightDate - leftDate;
  });
}

function albumCoverStyle(album: PhotoAlbumSummary): {
  background: string;
} {
  const accent =
    album.event_type && album.event_type in EVENT_TYPE_COLOR
      ? EVENT_TYPE_COLOR[album.event_type]
      : "#6366F1";
  return {
    background: `linear-gradient(
      145deg,
      color-mix(in srgb, ${accent} 38%, #f7f8fa) 0%,
      color-mix(in srgb, ${accent} 22%, #eef1f4) 52%,
      color-mix(in srgb, ${accent} 12%, #f4f5f7) 100%
    )`,
  };
}

async function downloadAlbum(album: PhotoAlbumSummary): Promise<void> {
  const count = albumMediaTotal(album);
  if (count === 0) {
    return;
  }
  if (count > LARGE_ALBUM_PHOTO_THRESHOLD) {
    const confirmed = window.confirm(
      "This may take a moment for large albums. Continue with download?",
    );
    if (!confirmed) {
      return;
    }
  }
  const result =
    album.kind === "custom"
      ? await downloadCustomMediaAlbum(album.id, {
          timeoutMs: ALBUM_DOWNLOAD_TIMEOUT_MS,
        })
      : await downloadEventPhotoAlbum(album.id, {
          timeoutMs: ALBUM_DOWNLOAD_TIMEOUT_MS,
        });
  triggerBrowserDownload(result.blob, result.filename);
}

function AlbumActionsMenu({ album }: { album: PhotoAlbumSummary }) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const albumHref = mediaAlbumHref(album);
  const uploadHref = `${albumHref}?upload=1`;

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

  function stopRowNav(event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}${albumHref}`;
    try {
      await navigator.clipboard.writeText(url);
      setOpen(false);
    } catch {
      setErrorMessage("Could not copy link.");
    }
  }

  async function handleDownload() {
    setBusy(true);
    setErrorMessage(null);
    try {
      await downloadAlbum(album);
      setOpen(false);
    } catch (caught) {
      setErrorMessage(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={["photo-archive-row__more", open ? "is-open" : ""]
        .filter(Boolean)
        .join(" ")}
      ref={rootRef}
      onClick={stopRowNav}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="photo-archive-row__more-btn"
        aria-label={`Actions for ${album.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          stopRowNav(event);
          setOpen((current) => !current);
        }}
      >
        <AppIcon icon={MoreHorizontal} size="xs" className="text-current" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="photo-archive-row__menu"
          aria-label="Album actions"
        >
          <button
            type="button"
            role="menuitem"
            className="photo-archive-row__menu-item"
            onClick={() => {
              setOpen(false);
              void navigate(albumHref);
            }}
          >
            Open
          </button>
          <button
            type="button"
            role="menuitem"
            className="photo-archive-row__menu-item"
            onClick={() => {
              setOpen(false);
              void navigate(uploadHref);
            }}
          >
            Upload
          </button>
          <button
            type="button"
            role="menuitem"
            className="photo-archive-row__menu-item"
            onClick={() => {
              void handleCopyLink();
            }}
          >
            Copy link
          </button>
          <button
            type="button"
            role="menuitem"
            className="photo-archive-row__menu-item"
            disabled={busy || albumMediaTotal(album) === 0}
            onClick={() => {
              void handleDownload();
            }}
          >
            {busy ? "Downloading…" : "Download"}
          </button>
        </div>
      ) : null}
      {errorMessage ? (
        <p className="photo-archive-row__menu-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function AlbumCover({ album }: { album: PhotoAlbumSummary }) {
  if (album.cover_thumbnail_url) {
    return (
      <div className="photo-archive-row__cover photo-archive-row__cover--filled">
        <img
          src={album.cover_thumbnail_url}
          alt=""
          className="photo-archive-row__cover-img"
          loading="lazy"
        />
      </div>
    );
  }

  const initial = album.title.trim().charAt(0).toUpperCase() || "A";

  return (
    <div
      className="photo-archive-row__cover photo-archive-row__cover--empty"
      style={albumCoverStyle(album)}
      aria-hidden="true"
    >
      <span className="photo-archive-row__cover-initial">{initial}</span>
    </div>
  );
}

export function PhotoAlbumGrid({ albums }: PhotoAlbumGridProps) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => sortAlbums(albums), [albums]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return sorted;
    }
    return sorted.filter((album) => {
      const typeLabel =
        album.event_type != null ? (EVENT_TYPE_LABELS[album.event_type] ?? "") : "Album";
      return (
        album.title.toLowerCase().includes(needle) ||
        typeLabel.toLowerCase().includes(needle)
      );
    });
  }, [query, sorted]);

  return (
    <div className="photo-archive-directory">
      <label className="photo-archive-search">
        <AppIcon icon={Search} size="sm" className="photo-archive-search__icon" />
        <span className="sr-only">Search albums</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search albums…"
        />
      </label>

      {filtered.length === 0 ? (
        <p className="photo-archive-directory__empty">No albums match your search.</p>
      ) : (
        <ul className="photo-archive-list">
          {filtered.map((album) => {
            const href = mediaAlbumHref(album);
            const dateLabel = formatAlbumDate(album.starts_at);
            const typeLabel =
              album.kind === "custom"
                ? "Album"
                : album.event_type
                  ? EVENT_TYPE_LABELS[album.event_type]
                  : null;
            const meta = [
              dateLabel,
              typeLabel,
              ...mediaMetaParts(album),
            ].filter(Boolean) as string[];

            return (
              <li key={`${album.kind}-${album.id}`}>
                <Link
                  to={
                    albumMediaTotal(album) === 0 ? `${href}?upload=1` : href
                  }
                  className="photo-archive-row"
                >
                  <AlbumCover album={album} />
                  <div className="photo-archive-row__body">
                    <div className="photo-archive-row__top">
                      <p className="photo-archive-row__title">{album.title}</p>
                      <div className="photo-archive-row__actions">
                        <AlbumActionsMenu album={album} />
                        <span className="photo-archive-row__open" aria-hidden="true">
                          Open →
                        </span>
                      </div>
                    </div>
                    <p className="photo-archive-row__meta">
                      {meta.map((part, index) => (
                        <span key={`${part}-${index}`}>
                          {index > 0 ? (
                            <span
                              className="photo-archive-row__sep"
                              aria-hidden="true"
                            >
                              ·
                            </span>
                          ) : null}
                          {part}
                        </span>
                      ))}
                    </p>
                    {albumMediaTotal(album) === 0 ? (
                      <p className="photo-archive-row__empty-cta">Add media →</p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
