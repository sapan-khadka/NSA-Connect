import axios from "axios";
import { Download } from "lucide-react";
import { useState } from "react";

import { getApiErrorMessage } from "../../lib/api-error";
import {
  ALBUM_DOWNLOAD_TIMEOUT_MS,
  downloadCustomMediaAlbum,
  downloadEventPhotoAlbum,
  LARGE_ALBUM_PHOTO_THRESHOLD,
  triggerBrowserDownload,
  type MediaAlbumKind,
} from "../../lib/photo-archive-api";
import { AppIcon } from "../ui/AppIcon";

type DownloadAlbumButtonProps = {
  albumId?: number;
  albumKind?: MediaAlbumKind;
  photoCount: number;
  /** @deprecated use albumId + albumKind="event" */
  eventId?: number;
};

export function DownloadAlbumButton({
  albumId: albumIdProp,
  albumKind = "event",
  photoCount,
  eventId,
}: DownloadAlbumButtonProps) {
  const albumId = albumIdProp ?? eventId ?? 0;
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (photoCount === 0 || isDownloading) {
      return;
    }

    if (photoCount > LARGE_ALBUM_PHOTO_THRESHOLD) {
      const confirmed = window.confirm(
        "This may take a moment for large albums. Continue with download?",
      );
      if (!confirmed) {
        return;
      }
    }

    setIsDownloading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ALBUM_DOWNLOAD_TIMEOUT_MS);

    try {
      const { blob, filename } =
        albumKind === "custom"
          ? await downloadCustomMediaAlbum(albumId, {
              signal: controller.signal,
              timeoutMs: ALBUM_DOWNLOAD_TIMEOUT_MS,
            })
          : await downloadEventPhotoAlbum(albumId, {
              signal: controller.signal,
              timeoutMs: ALBUM_DOWNLOAD_TIMEOUT_MS,
            });
      triggerBrowserDownload(blob, filename);
    } catch (caught) {
      if (axios.isAxiosError(caught) && caught.code === "ECONNABORTED") {
        setError(
          "Download timed out. Large albums can take a while — try again or download fewer photos at a time.",
        );
      } else if (controller.signal.aborted) {
        setError(
          "Download timed out. Large albums can take a while — try again in a moment.",
        );
      } else {
        setError(getApiErrorMessage(caught));
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={isDownloading || photoCount === 0}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        <AppIcon icon={Download} size="sm" className="text-current" />
        {isDownloading ? "Preparing download…" : "Download album"}
      </button>
      {error ? (
        <p role="alert" className="max-w-xs text-right text-xs text-urgent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
