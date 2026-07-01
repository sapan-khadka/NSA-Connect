import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DownloadAlbumButton } from "./DownloadAlbumButton";

vi.mock("../../lib/photo-archive-api", () => ({
  ALBUM_DOWNLOAD_TIMEOUT_MS: 120_000,
  LARGE_ALBUM_PHOTO_THRESHOLD: 50,
  downloadEventPhotoAlbum: vi.fn(),
  triggerBrowserDownload: vi.fn(),
}));

import {
  downloadEventPhotoAlbum,
  triggerBrowserDownload,
} from "../../lib/photo-archive-api";

const mockedDownloadEventPhotoAlbum = vi.mocked(downloadEventPhotoAlbum);
const mockedTriggerBrowserDownload = vi.mocked(triggerBrowserDownload);

describe("DownloadAlbumButton", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("downloads the album for any member", async () => {
    mockedDownloadEventPhotoAlbum.mockResolvedValue({
      blob: new Blob(["zip"]),
      filename: "dashain-2020-photos.zip",
    });

    render(<DownloadAlbumButton eventId={5} photoCount={3} />);

    fireEvent.click(screen.getByRole("button", { name: /download album/i }));

    await waitFor(() =>
      expect(mockedDownloadEventPhotoAlbum).toHaveBeenCalledWith(5, expect.any(Object)),
    );
    expect(mockedTriggerBrowserDownload).toHaveBeenCalledWith(
      expect.any(Blob),
      "dashain-2020-photos.zip",
    );
  });

  it("shows a loading state while preparing the download", async () => {
    let resolveDownload: ((value: { blob: Blob; filename: string }) => void) | undefined;
    mockedDownloadEventPhotoAlbum.mockReturnValue(
      new Promise((resolve) => {
        resolveDownload = resolve;
      }),
    );

    render(<DownloadAlbumButton eventId={5} photoCount={2} />);

    fireEvent.click(screen.getByRole("button", { name: /download album/i }));

    expect(screen.getByRole("button", { name: /preparing download/i })).toBeDisabled();

    resolveDownload?.({
      blob: new Blob(["zip"]),
      filename: "dashain-2020-photos.zip",
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /download album/i })).toBeEnabled(),
    );
  });

  it("warns before downloading large albums", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockedDownloadEventPhotoAlbum.mockResolvedValue({
      blob: new Blob(["zip"]),
      filename: "large-album.zip",
    });

    render(<DownloadAlbumButton eventId={5} photoCount={51} />);

    fireEvent.click(screen.getByRole("button", { name: /download album/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "This may take a moment for large albums. Continue with download?",
    );
    expect(mockedDownloadEventPhotoAlbum).not.toHaveBeenCalled();
  });
});
