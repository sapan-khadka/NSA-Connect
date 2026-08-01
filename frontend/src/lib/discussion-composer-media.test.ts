import { describe, expect, it, vi } from "vitest";

import {
  audioExtensionForMimeType,
  CURATED_COMPOSER_GIFS,
  formatRecordingClock,
  loadComposerGifs,
  pickMediaRecorderMimeType,
} from "./discussion-composer-media";

describe("pickMediaRecorderMimeType", () => {
  it("prefers webm opus when supported", () => {
    expect(
      pickMediaRecorderMimeType((mime) => mime === "audio/webm;codecs=opus"),
    ).toBe("audio/webm;codecs=opus");
  });

  it("falls back to audio/mp4", () => {
    expect(
      pickMediaRecorderMimeType((mime) => mime === "audio/mp4"),
    ).toBe("audio/mp4");
  });

  it("returns null when nothing is supported", () => {
    expect(pickMediaRecorderMimeType(() => false)).toBeNull();
  });
});

describe("audioExtensionForMimeType", () => {
  it("maps common audio mime types", () => {
    expect(audioExtensionForMimeType("audio/webm;codecs=opus")).toBe("webm");
    expect(audioExtensionForMimeType("audio/mp4")).toBe("m4a");
  });
});

describe("formatRecordingClock", () => {
  it("formats mm:ss", () => {
    expect(formatRecordingClock(0)).toBe("0:00");
    expect(formatRecordingClock(9)).toBe("0:09");
    expect(formatRecordingClock(75)).toBe("1:15");
  });
});

describe("loadComposerGifs", () => {
  it("uses curated list when no API key", async () => {
    const result = await loadComposerGifs(undefined, vi.fn());
    expect(result.source).toBe("curated");
    expect(result.gifs).toEqual(CURATED_COMPOSER_GIFS);
  });

  it("maps Tenor featured results when key works", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "abc",
            media_formats: {
              tinygif: { url: "https://example.com/tiny.gif" },
              gif: { url: "https://example.com/full.gif" },
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const result = await loadComposerGifs("test-key", fetchImpl);
    expect(result.source).toBe("tenor");
    expect(result.gifs).toEqual([
      {
        id: "abc",
        previewUrl: "https://example.com/tiny.gif",
        url: "https://example.com/full.gif",
      },
    ]);
  });
});
